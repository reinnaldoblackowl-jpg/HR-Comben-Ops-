const roles = {
  coordinator: 'Koordinasi pekerjaan HR dan review laporan',
  payroll: 'Validasi payroll dan rekonsiliasi selisih',
  benefit: 'Administrasi benefit dan simulasi biaya',
  compensation: 'Analisis struktur upah dan manpower cost',
  admin: 'Administrasi kontrak dan employee movement',
  attendance: 'Validasi absensi, cuti dan overtime',
  analyst: 'Analisis headcount, turnover dan reporting'
};

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/task') {
      return env.ASSETS.fetch(request);
    }

    const out = (data, status = 200) =>
      Response.json(data, {
        status,
        headers: {
          'Cache-Control': 'no-store'
        }
      });

    if (request.method !== 'POST') {
      return out({ error: 'Method not allowed' }, 405);
    }

    if (!env.PILOT_TOKEN) {
      return out({
        error: 'PILOT_TOKEN belum dikonfigurasi.'
      }, 503);
    }

    if (
      request.headers.get('Authorization') !==
      `Bearer ${env.PILOT_TOKEN}`
    ) {
      return out({
        error: 'Kode akses tidak sesuai.'
      }, 401);
    }

    if (!env.AI) {
      return out({
        error: 'Workers AI binding belum tersedia.'
      }, 503);
    }

    try {
      const { agent, task } = await request.json();

      if (
        !Object.hasOwn(roles, agent) ||
        typeof task !== 'string' ||
        !task.trim() ||
        task.length > 3000
      ) {
        return out({
          error: 'Instruksi tidak valid.'
        }, 400);
      }

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: 'system',
            content: `Anda adalah AI Agent Black Owl HR Virtual Office.
Spesialisasi: ${roles[agent]}.
Gunakan bahasa Indonesia yang profesional.
Gunakan data simulasi saja.
Jangan mengarang angka atau mengklaim akses database.
Jika data kurang, jelaskan data yang diperlukan.
Jangan menyetujui payroll atau mengubah data.
Seluruh hasil merupakan draft untuk review manusia.`
          },
          {
            role: 'user',
            content: task
          }
        ],
        max_tokens: 900
      });

      console.log('AI task completed:', agent, MODEL);

      return out({
        output: result.response ||
          'Model tidak menghasilkan teks.'
      });

    } catch (error) {
      console.error('WORKERS AI ERROR:', error.message);

      return out({
        error: 'AI gagal memproses tugas. Periksa Cloudflare Live Logs.'
      }, 502);
    }
  }
};
