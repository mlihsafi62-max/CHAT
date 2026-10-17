import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView, Platform, SafeAreaView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { io } from 'socket.io-client';
import { API } from './api';

export default function App() {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [view, setView] = useState('lobby'); 
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [convId, setConvId] = useState(null);
  
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomPassInput, setRoomPassInput] = useState('');
  const [generatedRoom, setGeneratedRoom] = useState(null);

  const socketRef = useRef(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 1000, useNativeDriver: true })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true })
      ])
    ).start();

    (async () => {
      const t = await AsyncStorage.getItem('token');
      const u = await AsyncStorage.getItem('user');
      if (t && u) { setToken(t); setMe(JSON.parse(u)); }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    const s = io(API, { auth: { token } });
    s.on('message:new', (m) => {
      setMessages((prev) => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
    });
    socketRef.current = s;
    return () => s.disconnect();
  }, [token]);

  const submitAuth = async () => {
    setError('');
    const path = mode === 'login' ? '/login' : '/register';
    try {
      const r = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) return setError(data.error || 'error');
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setMe(data.user);
    } catch (e) { setError('Erreur réseau'); }
  };

  const logout = async () => {
    await AsyncStorage.clear();
    socketRef.current?.disconnect();
    setToken(null); setMe(null); setMessages([]); setConvId(null); setView('lobby');
  };

  const createRoom = async () => {
    try {
      const r = await fetch(`${API}/rooms/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (r.ok) setGeneratedRoom(data);
      else alert('Erreur lors de la création');
    } catch { alert('Erreur réseau'); }
  };

  const joinRoom = async () => {
    if (!roomIdInput || !roomPassInput) return alert('ادخل ID والكود');
    try {
      const r = await fetch(`${API}/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: roomIdInput, roomPass: roomPassInput })
      });
      const data = await r.json();
      if (r.ok) openChat(data.roomId);
      else alert(data.error || 'معطيات غالطة');
    } catch { alert('Erreur réseau'); }
  };

  const openChat = async (id) => {
    setConvId(id);
    setView('chat');
    const r = await fetch(`${API}/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMessages(await r.json());
  };

  const send = () => {
    if (!draft.trim() || !convId) return;
    socketRef.current.emit('message:send', { conversationId: convId, body: draft });
    setDraft('');
  };

  const AnimatedCard = ({ children }) => (
    <Animated.View style={[
      s.glassCard, 
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: translateY }] }
    ]}>
      {children}
    </Animated.View>
  );

  // ---------------- SCREEN 1: LOGIN / REGISTER ----------------
  if (!token) {
    return (
      <View style={s.mainContainer}>
        <Video source={require('./assets/login-bg.mp4')} style={StyleSheet.absoluteFill} resizeMode="cover" isLooping shouldPlay isMuted />
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(5,2,0,0.95)']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={s.center}>
          <AnimatedCard>
            <View style={s.logoContainer}>
              <Animated.View style={[s.lockIcon, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={{color: '#ff4500', fontSize: 32, textShadowColor: '#ff4500', textShadowRadius: 20}}>🛡️</Text>
              </Animated.View>
              <Text style={s.logoText}>ILYASS</Text>
              <Text style={s.subtitle}>CONNEXION SÉCURISÉE</Text>
            </View>
            
            <View style={s.inputContainer}>
              <Text style={s.icon}>👤</Text>
              <TextInput style={s.input} placeholder="Nom d'utilisateur" placeholderTextColor="#888" value={username} onChangeText={setUsername} autoCapitalize="none" />
            </View>
            <View style={s.inputContainer}>
              <Text style={s.icon}>🔒</Text>
              <TextInput style={s.input} placeholder="Mot de passe" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
            </View>
            
            {error ? <Text style={s.err}>{error}</Text> : null}
            
            <TouchableOpacity onPress={submitAuth} style={s.btnWrapper} activeOpacity={0.8}>
              <LinearGradient colors={['#ff4500', '#8a2be2']} style={s.btn} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={s.btnText}>{mode === 'login' ? 'ACCÉDER →' : 'CRÉER →'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginTop: 25 }}>
              <Text style={s.link}>🛡️ {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà membre ? Se connecter'}</Text>
            </TouchableOpacity>
          </AnimatedCard>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------- SCREEN 2: LOBBY (JOIN CHAT) ----------------
  if (view === 'lobby') {
    return (
      <View style={s.mainContainer}>
        <Video source={require('./assets/lobby-bg.mp4')} style={StyleSheet.absoluteFill} resizeMode="cover" isLooping shouldPlay isMuted />
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(5,2,0,0.95)']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={s.flex}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{me?.username?.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={s.headerText}>{me?.username}</Text>
                <View style={{flexDirection:'row', alignItems:'center', gap: 5}}>
                    <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ff88', shadowColor: '#00ff88', shadowOpacity: 1, shadowRadius: 5}} /> 
                    <Text style={{color: '#00ff88', fontSize: 10, fontWeight: 'bold'}}>ONLINE</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={s.logoutBtn}>
              <Text style={s.logoutText}>EXIT</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
            <AnimatedCard>
              <View style={s.dividerContainer}>
                <View style={s.line} />
                <Text style={s.iconLarge}>⛓️</Text>
                <View style={s.line} />
              </View>

              <Text style={s.sectionTitle}>REJOINDRE UNE PASSERELLE</Text>
              
              <View style={s.inputContainer}>
                <Text style={s.icon}>🔗</Text>
                <TextInput style={s.input} placeholder="ID de la passerelle" placeholderTextColor="#888" value={roomIdInput} onChangeText={setRoomIdInput} keyboardType="number-pad" />
              </View>
              <View style={s.inputContainer}>
                <Text style={s.icon}>🔒</Text>
                <TextInput style={s.input} placeholder="Code secret" placeholderTextColor="#888" value={roomPassInput} onChangeText={setRoomPassInput} autoCapitalize="characters" />
              </View>
              
              <TouchableOpacity onPress={joinRoom} style={s.btnWrapper} activeOpacity={0.8}>
                <LinearGradient colors={['#ff4500', '#ff8c00']} style={s.btn} start={{x:0, y:0}} end={{x:1, y:0}}>
                  <Text style={s.btnText}>REJOINDRE →</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setView('create')} style={s.createBtn}>
                <Text style={s.createBtnText}>+ CRÉER UNE NOUVELLE PASSERELLE</Text>
              </TouchableOpacity>
            </AnimatedCard>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------- SCREEN 3: CREATE ROOM ----------------
  if (view === 'create') {
    return (
      <View style={s.mainContainer}>
        <Video source={require('./assets/lobby-bg.mp4')} style={StyleSheet.absoluteFill} resizeMode="cover" isLooping shouldPlay isMuted />
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(5,2,0,0.95)']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={s.flex}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setView('lobby'); setGeneratedRoom(null); }}>
              <Text style={s.backBtn}>← Retour</Text>
            </TouchableOpacity>
            <Text style={s.headerText}>GÉNÉRATEUR</Text>
            <View style={{width: 60}}/>
          </View>
          <View style={s.center}>
            <AnimatedCard>
              {!generatedRoom ? (
                <>
                  <Text style={s.infoText}>Créez une passerelle privée</Text>
                  <TouchableOpacity onPress={createRoom} style={s.btnWrapper} activeOpacity={0.8}>
                    <LinearGradient colors={['#ff4500', '#8a2be2']} style={s.btn} start={{x:0, y:0}} end={{x:1, y:0}}>
                      <Text style={s.btnText}>GÉNÉRER</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={s.successTitle}>PASSERELLE OUVERTE</Text>
                  <Text style={s.successSub}>Partagez ces coordonnées :</Text>
                  
                  <View style={s.codeBox}>
                    <Text style={s.codeText}>ID: <Text style={s.codeValue}>{generatedRoom.roomId}</Text></Text>
                    <Text style={s.codeText}>CODE: <Text style={s.codeValue}>{generatedRoom.roomPass}</Text></Text>
                  </View>
                  
                  <TouchableOpacity onPress={() => openChat(generatedRoom.roomId)} style={s.btnWrapper} activeOpacity={0.8}>
                    <LinearGradient colors={['#ff8c00', '#ff4500']} style={s.btn} start={{x:0, y:0}} end={{x:1, y:0}}>
                      <Text style={s.btnText}>ENTRER</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </AnimatedCard>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------- SCREEN 4: CHAT ----------------
  return (
    <View style={s.mainContainer}>
      <Video source={require('./assets/chat-bg.mp4')} style={StyleSheet.absoluteFill} resizeMode="cover" isLooping shouldPlay isMuted />
      
      {/* تعتيم قوي باش نقدرو نقراو الرسائل */}
      <LinearGradient 
        colors={['rgba(5, 2, 0, 0.85)', 'rgba(5, 2, 0, 0.95)']} 
        style={StyleSheet.absoluteFill} 
      />
      
      <SafeAreaView style={s.flex}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setView('lobby'); setConvId(null); setMessages([]); }}>
            <Text style={s.backBtn}>← EXIT</Text>
          </TouchableOpacity>
          <Text style={s.headerText}>PASSERELLE {convId}</Text>
          <View style={{ width: 50 }} />
        </View>

        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => (
              <View style={[s.msg, item.sender_id === me.id ? s.msgMe : s.msgOther]}>
                <Text style={[s.msgText, item.sender_id === me.id ? {color: '#1a0a00'} : {color: '#fff'}]}>{item.body}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
          />
          
          <View style={s.inputRow}>
            <TextInput 
              style={s.inputFlex} 
              value={draft} 
              onChangeText={setDraft} 
              placeholder="Transmettre un message..." 
              placeholderTextColor="#888" 
              multiline
            />
            <TouchableOpacity style={s.sendBtn} onPress={send}>
              <LinearGradient colors={['#ff4500', '#ff8c00']} style={s.sendBtnGradient}>
                <Text style={s.sendBtnText}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#050300' },
  flex: { flex: 1, width: '100%' },
  center: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  glassCard: { 
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: 'rgba(15, 10, 5, 0.75)', 
    borderRadius: 24, 
    padding: 30, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 69, 0, 0.4)',
    shadowColor: '#ff4500', 
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, 
    shadowRadius: 30,
    elevation: 20, 
  },
  
  logoContainer: { alignItems: 'center', marginBottom: 35 },
  lockIcon: { 
    width: 80, height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,69,0,0.1)', 
    borderWidth: 2, 
    borderColor: 'rgba(255,69,0,0.8)', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    shadowColor: '#ff4500', shadowOpacity: 0.8, shadowRadius: 25
  },
  logoText: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: 8, marginBottom: 5, textShadowColor: 'rgba(255, 69, 0, 1)', textShadowRadius: 25 },
  subtitle: { fontSize: 11, color: '#bbb', letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, marginBottom: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  icon: { fontSize: 18, marginRight: 12, opacity: 0.9, color: '#ff4500' },
  iconLarge: { fontSize: 24, color: '#ff4500', marginHorizontal: 15, textShadowColor: '#ff4500', textShadowRadius: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 18, outlineStyle: 'none' },
  
  btnWrapper: { marginTop: 10, borderRadius: 14, overflow: 'hidden', shadowColor: '#ff4500', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 5 } },
  btn: { padding: 18, alignItems: 'center', borderRadius: 14 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  
  link: { color: '#aaa', textAlign: 'center', fontSize: 13, letterSpacing: 1 },
  err: { color: '#ff4b4b', textAlign: 'center', marginBottom: 15, fontSize: 13, fontWeight: 'bold' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'rgba(10,5,0,0.85)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,69,0,0.2)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,69,0,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,69,0,0.8)', shadowColor: '#ff4500', shadowOpacity: 0.5, shadowRadius: 15 },
  avatarText: { color: '#ff4500', fontWeight: '900', fontSize: 20 },
  headerText: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },
  backBtn: { color: '#ff4500', fontSize: 15, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: 'rgba(255,69,0,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,69,0,0.6)' },
  logoutText: { color: '#ff4500', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  
  sectionTitle: { color: '#ff4500', fontSize: 16, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: 3 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,69,0,0.4)' },
  createBtn: { marginTop: 25, padding: 18, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,69,0,0.7)', borderRadius: 14 },
  createBtnText: { color: '#ff4500', textAlign: 'center', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  
  infoText: { color: '#ff8c00', fontSize: 16, marginBottom: 30, textAlign: 'center', letterSpacing: 1 },
  successTitle: { color: '#fff', fontSize: 20, marginBottom: 10, fontWeight: '900', letterSpacing: 2, textShadowColor: '#ff4500', textShadowRadius: 15 },
  successSub: { color: '#aaa', fontSize: 14, marginBottom: 25 },
  codeBox: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 25, borderRadius: 16, marginBottom: 25, width: '100%', borderWidth: 1, borderColor: 'rgba(255,69,0,0.5)', shadowColor: '#ff4500', shadowOpacity: 0.3, shadowRadius: 15 },
  codeText: { color: '#ff8c00', fontSize: 16, marginBottom: 10, textAlign: 'center', letterSpacing: 1 },
  codeValue: {fontWeight:'900', color:'#fff', fontSize: 20, letterSpacing: 3},
  
  msg: { padding: 16, borderRadius: 20, marginVertical: 8, maxWidth: '80%' },
  msgMe: { backgroundColor: '#ff8c00', alignSelf: 'flex-end', borderBottomRightRadius: 4, shadowColor: '#ff4500', shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: {width: 0, height: 5}, borderWidth: 1, borderColor: '#ffb347' },
  msgOther: { backgroundColor: 'rgba(30,20,15,0.9)', alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,69,0,0.3)', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  msgText: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  
  inputRow: { flexDirection: 'row', padding: 15, backgroundColor: 'rgba(10,5,0,0.95)', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,69,0,0.3)' },
  inputFlex: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25, padding: 16, color: '#fff', marginRight: 12, outlineStyle: 'none', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,69,0,0.4)', maxHeight: 100 },
  sendBtn: { borderRadius: 50, overflow: 'hidden', shadowColor: '#ff4500', shadowOpacity: 0.9, shadowRadius: 20 },
  sendBtnGradient: { padding: 15, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '900', fontSize: 24, marginTop: -4 }
});