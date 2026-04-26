const { google } = require('googleapis');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.SHEET_ID_MATHEUS;

    const [entrevistas, comissao, vagas, vagasMeta, vagasEntregues] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entrevistas!A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Comissões!A:H' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Abril!A:N' }),
      // C1 = total de vagas do mês
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Abril!C1' }),
      // M1 = vagas entregues
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Abril!M1' }),
    ]);

    // Total vagas (célula C1)
    const totalVagasC1 = parseInt(
      (vagasMeta.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    // Vagas entregues (célula M1)
    const vagasEntreguesM1 = parseInt(
      (vagasEntregues.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    // Entrevistas (pula cabeçalho linha 1)
    const entrevistasData = (entrevistas.data.values || []).slice(1).map(row => ({
      dia:       row[0] || '',
      recruiter: row[1] || '',
      candidato: row[2] || '',
      linkedin:  row[3] || '',
      resultado: row[4] || '',
      status:    row[5] || '',
    })).filter(r => r.dia);

    // Comissão (pula cabeçalho linha 1, ignora linha "RECRUITER")
    const comissaoData = (comissao.data.values || []).slice(1).map(row => ({
      recruiter:    row[0] || '',
      mes:          row[1] || '',
      vagaEntregue: row[2] || '',
      valor:        row[3] || '',
      level:        row[4] || '',
      meta:         row[5] || '',
      entregue:     row[6] || '',
      percentual:   row[7] || '',
    })).filter(r => r.recruiter && r.recruiter.toUpperCase() !== 'RECRUITER' && r.recruiter.toUpperCase() !== 'RECRUTADOR');

    // Vagas (pula 2 linhas de cabeçalho)
    const vagasData = (vagas.data.values || []).slice(2).map(row => ({
      mes:         row[0] || '',
      quantidade:  row[1] || '',
      vaga:        row[2] || '',
      candidatos:  row[3] || '',
      fitcultural: row[4] || '',
      validacao:   row[5] || '',
      teste:       row[6] || '',
      peopleRec:   row[7] || '',
      peopleBP:    row[8] || '',
      gestao:      row[9] || '',
      headCase:    row[10] || '',
      referencias: row[11] || '',
      comite:      row[12] || '',
      offer:       row[13] || '',
    })).filter(r => r.vaga);

    res.status(200).json({
      ok: true,
      totalVagasC1,
      vagasEntreguesM1,
      entrevistas: entrevistasData,
      comissao: comissaoData,
      vagas: vagasData,
    });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
