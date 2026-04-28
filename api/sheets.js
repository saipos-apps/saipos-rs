const { google } = require('googleapis');

async function getSheetData(sheets, sheetId, recruiterName) {
  try {
    const [entrevistas, comissao, vagas, vagasTotalCell, vagasEntreguesCell] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entrevistas!A:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Comissões!A:H' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Vagas!A:N' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Vagas!C1' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Vagas!M1' }),
    ]);

    const totalVagasC1 = parseInt(
      (vagasTotalCell.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    const vagasEntreguesM1 = parseInt(
      (vagasEntreguesCell.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    const entrevistasData = (entrevistas.data.values || []).slice(1).map(row => ({
      dia:       row[0] || '',
      recruiter: row[1] || recruiterName,
      candidato: row[2] || '',
      linkedin:  row[3] || '',
      resultado: row[4] || '',
      status:    row[5] || '',
    })).filter(r => r.dia);

    const comissaoData = (comissao.data.values || []).slice(1).map(row => ({
      recruiter:    row[0] || '',
      mes:          row[1] || '',
      vagaEntregue: row[2] || '',
      valor:        row[3] || '',
      level:        row[4] || '',
      meta:         row[5] || '',
      entregue:     row[6] || '',
      percentual:   row[7] || '',
    })).filter(r => r.recruiter && !['RECRUITER','RECRUTADOR'].includes((r.recruiter||'').toUpperCase().trim()));

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
      recruiter:   recruiterName,
    })).filter(r => r.vaga);

    return { entrevistasData, comissaoData, vagasData, totalVagasC1, vagasEntreguesM1 };

  } catch (error) {
    console.error(`Erro ao ler planilha de ${recruiterName}:`, error.message);
    return { entrevistasData: [], comissaoData: [], vagasData: [], totalVagasC1: 0, vagasEntreguesM1: 0 };
  }
}

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

    // Lê as 3 planilhas em paralelo
    const [matheus, amanda, lithielle] = await Promise.all([
      getSheetData(sheets, process.env.SHEET_ID_MATHEUS,   'Matheus Souza'),
      getSheetData(sheets, process.env.SHEET_ID_AMANDA,    'Amanda Antunes'),
      getSheetData(sheets, process.env.SHEET_ID_LITHIELLE, 'Lithielle Goulardt'),
    ]);

    // Junta tudo
    const entrevistas = [
      ...matheus.entrevistasData,
      ...amanda.entrevistasData,
      ...lithielle.entrevistasData,
    ];

    const comissao = [
      ...matheus.comissaoData,
      ...amanda.comissaoData,
      ...lithielle.comissaoData,
    ];

    const vagas = [
      ...matheus.vagasData,
      ...amanda.vagasData,
      ...lithielle.vagasData,
    ];

    // Totais de vagas somados das 3 planilhas
    const totalVagasC1 =
      matheus.totalVagasC1 +
      amanda.totalVagasC1 +
      lithielle.totalVagasC1;

    const vagasEntreguesM1 =
      matheus.vagasEntreguesM1 +
      amanda.vagasEntreguesM1 +
      lithielle.vagasEntreguesM1;

    // Dados individuais por recrutador (para a aba de recrutadores)
    const porRecrutador = {
      matheus: {
        nome: 'Matheus Souza',
        entrevistas: matheus.entrevistasData,
        comissao: matheus.comissaoData,
        vagas: matheus.vagasData,
        totalVagasC1: matheus.totalVagasC1,
        vagasEntreguesM1: matheus.vagasEntreguesM1,
      },
      amanda: {
        nome: 'Amanda Antunes',
        entrevistas: amanda.entrevistasData,
        comissao: amanda.comissaoData,
        vagas: amanda.vagasData,
        totalVagasC1: amanda.totalVagasC1,
        vagasEntreguesM1: amanda.vagasEntreguesM1,
      },
      lithielle: {
        nome: 'Lithielle Goulardt',
        entrevistas: lithielle.entrevistasData,
        comissao: lithielle.comissaoData,
        vagas: lithielle.vagasData,
        totalVagasC1: lithielle.totalVagasC1,
        vagasEntreguesM1: lithielle.vagasEntreguesM1,
      },
    };

    res.status(200).json({
      ok: true,
      totalVagasC1,
      vagasEntreguesM1,
      entrevistas,
      comissao,
      vagas,
      porRecrutador,
    });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
