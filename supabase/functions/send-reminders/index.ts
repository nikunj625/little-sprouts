// send-reminders — Supabase Edge Function (Deno)
// Pushes a reminder to a household when a member's checklist is missing/incomplete
// around their reminder_time. Safe to run even before VAPID secrets are set
// (it simply no-ops the sending part until keys exist).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const PUSH_READY = !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (PUSH_READY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const db = createClient(SUPABASE_URL, SERVICE_KEY);

function nowInTz(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

Deno.serve(async () => {
  if (!PUSH_READY) {
    return new Response(JSON.stringify({ ok: false, reason: "VAPID keys not set yet" }),
      { headers: { "Content-Type": "application/json" } });
  }
  const WINDOW = 15, sent: string[] = [];
  const { data: households } = await db.from("households").select("id, timezone");
  for (const hh of households ?? []) {
    const { date, minutes } = nowInTz(hh.timezone || "Asia/Kolkata");
    const { data: members } = await db.from("members").select("id,name,reminder_time,type").eq("household_id", hh.id);
    const { data: habits } = await db.from("habits").select("scope,active").eq("household_id", hh.id).eq("active", true);
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("household_id", hh.id);
    if (!subs?.length) continue;

    for (const mem of members ?? []) {
      if (!mem.reminder_time) continue;
      const due = toMin(mem.reminder_time);
      if (minutes < due || minutes >= due + WINDOW) continue;

      const { data: log } = await db.from("daily_logs").select("habits")
        .eq("member_id", mem.id).eq("log_date", date).maybeSingle();
      const total = (habits ?? []).filter((h) => h.scope === mem.type).length;
      const done = log ? Object.values(log.habits ?? {}).filter(Boolean).length : 0;
      if (log && done >= total) continue;

      const body = done === 0
        ? `${mem.name}'s checklist hasn't been started today.`
        : `${mem.name}'s checklist is only ${done}/${total} done.`;

      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: "Little Sprouts ⏰", body, tag: "daily-" + mem.id, url: "./" }),
          );
          sent.push(mem.name);
        } catch (err) {
          // deno-lint-ignore no-explicit-any
          const code = (err as any)?.statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
