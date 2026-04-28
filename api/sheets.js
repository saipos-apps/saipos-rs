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

    // C1 = total de vagas
    const totalVagasC1 = parseInt(
      (vagasTotalCell.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    // M1 = vagas entregues
    const vagasEntreguesM1 = parseInt(
      (vagasEntreguesCell.data.values?.[0]?.[0] || '0').toString().replace(/\D/g, '')
    ) || 0;

    // Mês atual para filtrar entrevistas
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mesAtual = meses[new Date().getMonth()].toUpperCase();

    // Helper para converter valor BRL em número
    function parseBRL(val) {
      if (!val) return 0;
      const str = val.toString()
        .replace('R$', '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      return parseFloat(str) || 0;
    }

    // Entrevistas — filtra só mês atual
    const entrevistasData = (entrevistas.data.values || []).slice(1)
      .map(row => ({
        dia:       row[0] || '',
        recruiter: row[1] || recruiterName,
        candidato: row[2] || '',
        linkedin:  row[3] || '',
        resultado: (row[4] || '').toString().toUpperCase().trim(),
        status:    (row[5] || '').toString().toUpperCase().trim(),
      }))
      .filter(r => {
        if (!r.dia) return false;
        // Filtra pelo mês atual na data
        const diaStr = r.dia.toString().toUpperCase();
        // Formato: dd/MM/yyyy — pega o mês
        const partes = r.dia.toString().replace(' às ', ' ').split(/[\s/]/);
        if (partes.length >= 3) {
          const mesNum = parseInt(partes[1]);
          const anoNum = parseInt(partes[2]);
          const hoje = new Date();
          return mesNum === (hoje.getMonth() + 1) && anoNum === hoje.getFullYear();
        }
        return true;
      });

    // Comissão — ignora cabeçalho e linhas inválidas, converte valor para número
    const comissaoData = (comissao.data.values || []).slice(1)
      .map(row => ({
        recruiter:    (row[0] || '').toString().trim(),
        mes:          row[1] || '',
        vagaEntregue: row[2] || '',
        valor:        parseBRL(row[3]),
        level:        row[4] || '',
        meta:         row[5] || '',
        entregue:     row[6] || '',
        percentual:   row[7] || '',
      }))
      .filter(r => {
        const n = r.recruiter.toUpperCase();
        return r.recruiter && !['RECRUITER','RECRUTADOR','RECRUITER'].includes(n) && r.valor >= 0;
      });

    // Vagas — pula 2 linhas de cabeçalho
    const vagasData = (vagas.data.values || []).slice(2)
      .map(row => ({
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
      }))
      .filter(r => r.vaga);

    return { entrevistasData, comissaoData, vagasData, totalVagasC1, vagasEntreguesM1 };

  } catch (error) {
    console.error(`Erro ao ler planilha de ${recruiterName}:`, error.message);
    return { entrevistasData:[], comissaoData:[], vagasData:[], totalVagasC1:0, vagasEntreguesM1:0 };
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

    const [matheus, amanda, lithielle] = await Promise.all([
      getSheetData(sheets, process.env.SHEET_ID_MATHEUS,   'Matheus Souza'),
      getSheetData(sheets, process.env.SHEET_ID_AMANDA,    'Amanda Antunes'),
      getSheetData(sheets, process.env.SHEET_ID_LITHIELLE, 'Lithielle Goulardt'),
    ]);

    const entrevistas = [...matheus.entrevistasData, ...amanda.entrevistasData, ...lithielle.entrevistasData];
    const comissao    = [...matheus.comissaoData,    ...amanda.comissaoData,    ...lithielle.comissaoData];
    const vagas       = [...matheus.vagasData,       ...amanda.vagasData,       ...lithielle.vagasData];

    const totalVagasC1     = matheus.totalVagasC1     + amanda.totalVagasC1     + lithielle.totalVagasC1;
    const vagasEntreguesM1 = matheus.vagasEntreguesM1 + amanda.vagasEntreguesM1 + lithielle.vagasEntreguesM1;

    const porRecrutador = {
      matheus:  { nome:'Matheus Souza',    ...matheus,  entrevistas:matheus.entrevistasData,  comissao:matheus.comissaoData,  vagas:matheus.vagasData  },
      amanda:   { nome:'Amanda Antunes',   ...amanda,   entrevistas:amanda.entrevistasData,   comissao:amanda.comissaoData,   vagas:amanda.vagasData   },
      lithielle:{ nome:'Lithielle Goulardt',...lithielle,entrevistas:lithielle.entrevistasData,comissao:lithielle.comissaoData,vagas:lithielle.vagasData},
    };

    res.status(200).json({ ok:true, totalVagasC1, vagasEntreguesM1, entrevistas, comissao, vagas, porRecrutador });

  } catch (error) {
    res.status(500).json({ ok:false, error: error.message });
  }
}
