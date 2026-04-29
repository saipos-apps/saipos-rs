// firebase-config.js
// ========================================
// CONFIGURAÇÃO DO FIREBASE
// ========================================

// TODO: Substitua com suas credenciais do Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBRypB3wlZXeFLpr8tXxux2LJ5d0LLRhIw",
  authDomain: "saipos-rs-dashboard.firebaseapp.com",
  projectId: "saipos-rs-dashboard",
  storageBucket: "saipos-rs-dashboard.firebasestorage.app",
  messagingSenderId: "1011983857321",
  appId: "1:1011983857321:web:f7afca08ae7a1184dd5bb8"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar serviços
const auth = firebase.auth();
const db = firebase.firestore();

// ========================================
// ESTRUTURA DO FIRESTORE
// ========================================

/*
Coleções:

1. users (usuários/recrutadores)
   └─ {userId}
      ├─ nome: string
      ├─ email: string
      ├─ role: "admin" | "recruiter"
      ├─ sheetName: string (nome na planilha)
      ├─ foto: string (URL)
      ├─ ativo: boolean
      └─ criadoEm: timestamp

2. metas (metas mensais)
   └─ {userId}
      └─ {ano-mes} (ex: "2024-05")
         ├─ entrevistas: number
         ├─ admissoes: number
         ├─ ligacoes: number
         └─ atualizadoEm: timestamp

3. bonus (bônus individuais)
   └─ {bonusId}
      ├─ userId: string
      ├─ descricao: string
      ├─ valor: number
      ├─ mes: string (ano-mes)
      └─ criadoEm: timestamp

4. config (configurações globais)
   └─ geral
      ├─ sheetId: string (ID da planilha Google)
      └─ mesAtual: string (ano-mes)
*/

// ========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ========================================

// Login com email e senha
async function loginUsuario(email, senha) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, senha);
    const user = userCredential.user;
    
    // Buscar dados do usuário no Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado no banco de dados');
    }
    
    return {
      uid: user.uid,
      email: user.email,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
}

// Logout
async function logoutUsuario() {
  try {
    await auth.signOut();
    return true;
  } catch (error) {
    console.error('Erro no logout:', error);
    throw error;
  }
}

// Verificar se usuário está logado (ao carregar página)
function verificarAutenticacao(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Usuário logado - buscar dados completos
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        callback({
          uid: user.uid,
          email: user.email,
          ...userDoc.data()
        });
      } else {
        callback(null);
      }
    } else {
      // Usuário não logado
      callback(null);
    }
  });
}

// ========================================
// FUNÇÕES DE USUÁRIOS (ADMIN)
// ========================================

// Criar novo recrutador
async function criarRecrutador(dadosRecrutador) {
  try {
    // Criar usuário no Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(
      dadosRecrutador.email,
      dadosRecrutador.senhaTemporaria
    );
    
    const userId = userCredential.user.uid;
    
    // Salvar dados no Firestore
    await db.collection('users').doc(userId).set({
      nome: dadosRecrutador.nome,
      email: dadosRecrutador.email,
      role: 'recruiter',
      sheetName: dadosRecrutador.sheetName,
      foto: dadosRecrutador.foto || '',
      ativo: true,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Enviar email para redefinir senha
    await auth.sendPasswordResetEmail(dadosRecrutador.email);
    
    return userId;
  } catch (error) {
    console.error('Erro ao criar recrutador:', error);
    throw error;
  }
}

// Listar todos os recrutadores
async function listarRecrutadores() {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'recruiter')
      .orderBy('nome')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erro ao listar recrutadores:', error);
    throw error;
  }
}

// Atualizar dados do recrutador
async function atualizarRecrutador(userId, dados) {
  try {
    await db.collection('users').doc(userId).update({
      ...dados,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Erro ao atualizar recrutador:', error);
    throw error;
  }
}

// Desativar recrutador
async function desativarRecrutador(userId) {
  try {
    await db.collection('users').doc(userId).update({
      ativo: false,
      desativadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Erro ao desativar recrutador:', error);
    throw error;
  }
}

// ========================================
// FUNÇÕES DE METAS
// ========================================

// Salvar meta mensal
async function salvarMeta(userId, mes, metas) {
  try {
    await db.collection('metas').doc(userId).set({
      [mes]: {
        entrevistas: metas.entrevistas || 0,
        admissoes: metas.admissoes || 0,
        ligacoes: metas.ligacoes || 0,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    throw error;
  }
}

// Buscar meta mensal
async function buscarMeta(userId, mes) {
  try {
    const doc = await db.collection('metas').doc(userId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return data[mes] || null;
  } catch (error) {
    console.error('Erro ao buscar meta:', error);
    throw error;
  }
}

// ========================================
// FUNÇÕES DE BÔNUS
// ========================================

// Adicionar bônus
async function adicionarBonus(userId, mes, descricao, valor) {
  try {
    await db.collection('bonus').add({
      userId: userId,
      mes: mes,
      descricao: descricao,
      valor: parseFloat(valor),
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Erro ao adicionar bônus:', error);
    throw error;
  }
}

// Listar bônus de um usuário em um mês
async function listarBonus(userId, mes) {
  try {
    const snapshot = await db.collection('bonus')
      .where('userId', '==', userId)
      .where('mes', '==', mes)
      .orderBy('criadoEm', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erro ao listar bônus:', error);
    throw error;
  }
}

// Remover bônus
async function removerBonus(bonusId) {
  try {
    await db.collection('bonus').doc(bonusId).delete();
    return true;
  } catch (error) {
    console.error('Erro ao remover bônus:', error);
    throw error;
  }
}

// ========================================
// FUNÇÕES DE CONFIGURAÇÃO
// ========================================

// Salvar configuração geral
async function salvarConfig(chave, valor) {
  try {
    await db.collection('config').doc('geral').set({
      [chave]: valor
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    throw error;
  }
}

// Buscar configuração
async function buscarConfig(chave) {
  try {
    const doc = await db.collection('config').doc('geral').get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data()[chave] || null;
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    throw error;
  }
}

// ========================================
// LISTENERS EM TEMPO REAL
// ========================================

// Escutar mudanças nas metas
function escutarMetas(userId, mes, callback) {
  return db.collection('metas').doc(userId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        callback(data[mes] || null);
      } else {
        callback(null);
      }
    });
}

// Escutar mudanças nos bônus
function escutarBonus(userId, mes, callback) {
  return db.collection('bonus')
    .where('userId', '==', userId)
    .where('mes', '==', mes)
    .onSnapshot((snapshot) => {
      const bonus = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(bonus);
    });
}

// ========================================
// UTILITÁRIOS
// ========================================

// Formatar mês atual (YYYY-MM)
function getMesAtual() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

// Formatar mês específico
function formatarMes(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
