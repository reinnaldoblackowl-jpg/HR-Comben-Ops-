const VERSION = "1.2.0";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const roles = {
  coordinator: "Koordinasi pekerjaan HR dan review laporan",
  payroll: "Validasi payroll dan rekonsiliasi selisih",
  benefit: "Administrasi benefit dan simulasi biaya",
  compensation: "Analisis struktur upah dan manpower cost",
  admin: "Administrasi kontrak dan employee movement",
  attendance: "Validasi absensi, cuti dan overtime",
  analyst: "Analisis headcount, turnover dan reporting"
};

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    const out = (data, status = 200) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store"
        }
      });

    // SYSTEM VERSION
    if (url.pathname === "/api/health") {
      return out({
        system: "Black Owl HR Virtual Office",
        version: VERSION,
        status: "Online"
      });
    }

    if (url.pathname !== "/api/task") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return out({
        error: "Method not allowed"
      }, 405);
    }

    if (!env.PILOT_TOKEN) {
      return out({
        error: "PILOT_TOKEN belum tersedia."
      }, 503);
    }

    if (
      request.headers.get("Authorization") !==
      `Bearer ${env.PILOT_TOKEN}`
    ) {
      return out({
        error: "Kode Pilot Token tidak sesuai."
      }, 401);
    }

    if (!env.AI || typeof env.AI.run !== "function") {
      return out({
        error: "Workers AI Binding tidak tersedia."
      }, 503);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return out({
        error: "Format request tidak valid."
      }, 400);
    }

    const { agent, task } = body || {};

    if (
      !Object.hasOwn(roles, agent) ||
      typeof task !== "string" ||
      !task.trim() ||
      task.length > 3000
    ) {
      return out({
        error: "Instruksi atau agent tidak valid."
      }, 400);
    }

    try {

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: `
Anda adalah AI Agent Black Owl HR Virtual Office.
Spesialisasi: ${roles[agent]}.
Gunakan bahasa Indonesia profesional.
Gunakan data simulasi saja.
Jangan mengarang data perusahaan.
Jangan mengklaim akses database.
Jangan mengubah data atau menyetujui payroll.
Hasil merupakan draft untuk review manusia.
`
          },
          {
            role: "user",
            content: task
          }
        ],
        max_tokens: 512
      });

      if (
        typeof result?.response !== "string" ||
        !result.response.trim()
      ) {
        return out({
          error: "AI terhubung tetapi tidak menghasilkan teks."
        }, 502);
      }

      return out({
        version: VERSION,
        model: MODEL,
        output: result.response
      });

    } catch (error) {

      const raw = String(
        error?.message || error || "Unknown error"
      );

      const detail = raw
        .split(env.PILOT_TOKEN).join("[REDACTED]")
        .replace(/Bearer\s+\S+/gi, "[REDACTED]")
        .slice(0, 500);

      console.error("AI_DIAGNOSTIC_V12", {
        model: MODEL,
        detail
      });

      return out({
        version: VERSION,
        error: "Workers AI Error: " + detail
      }, 502);
    }
  }
};
