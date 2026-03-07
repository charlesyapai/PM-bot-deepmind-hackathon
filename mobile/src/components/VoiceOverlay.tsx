import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { supabase } from '../lib/supabase';

type VoiceOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

export const VoiceOverlay = ({ visible, onClose }: VoiceOverlayProps) => {
  const [status, setStatus] = useState<'listening' | 'processing' | 'done' | 'error'>('listening');
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [textCommand, setTextCommand] = useState('');
  const [clarifyPrompt, setClarifyPrompt] = useState('');
  const [respondMessage, setRespondMessage] = useState('');
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [boardUpdateProgress, setBoardUpdateProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wsRef = useRef<WebSocket | null>(null);

  // Pulse animation
  useEffect(() => {
    if (!visible || status !== 'listening') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible, status, pulseAnim]);

  const connectWebSocket = useCallback(async () => {
    let token: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      // no token
    }

    const baseUrl = 'ws://127.0.0.1:3000/voice/stream';
    const wsUrl = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('listening');
      setTranscript('');
      setPartialTranscript('');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'partial') {
          setPartialTranscript(data.transcript || '');
        } else if (data.type === 'final') {
          setTranscript((prev) => (prev ? prev + ' ' : '') + (data.transcript || ''));
          setPartialTranscript('');
        } else if (data.type === 'action') {
          const result = data.result || {};
          const intent = data.intent || {};
          if (intent.name === 'clarify') {
            const question = result.message || intent.args?.promptText || 'Could you clarify?';
            setClarifyPrompt(question);
            setRespondMessage('');
            setSuggestedActions([]);
            setActionResult('');
            setStatus('listening');
          } else if (intent.name === 'respond') {
            const msg = intent.args?.message || result.message || '';
            const chips: string[] = intent.args?.suggestedActions || [];
            setRespondMessage(msg);
            setSuggestedActions(chips);
            setClarifyPrompt('');
            setActionResult(result.message || '');
            setStatus('done');
          } else {
            setClarifyPrompt('');
            setRespondMessage('');
            setSuggestedActions([]);
            setActionResult(result.message || `Done: ${intent.name}`);
            setStatus(result.success ? 'done' : 'error');
          }
        } else if (data.type === 'board_update_progress') {
          setBoardUpdateProgress({
            step: data.step || 'Working...',
            current: data.current ?? 0,
            total: data.total ?? 4,
          });
          setStatus('processing');
        } else if (data.type === 'error') {
          setActionResult(data.message || 'Something went wrong.');
          setStatus('error');
        }
      } catch {
        setPartialTranscript(event.data as string);
      }
    };

    ws.onerror = () => setStatus('error');
    ws.onclose = () => {};
  }, []);

  useEffect(() => {
    if (visible) {
      setStatus('listening');
      setTranscript('');
      setPartialTranscript('');
      setTextCommand('');
      setActionResult('');
      setClarifyPrompt('');
      setRespondMessage('');
      setSuggestedActions([]);
      setBoardUpdateProgress(null);
      connectWebSocket();
    } else {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [visible, connectWebSocket]);

  const handleSendText = useCallback(() => {
    if (!textCommand.trim()) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text_command', transcript: textCommand.trim() }));
    }
    setTextCommand('');
    setStatus('processing');
  }, [textCommand]);

  const handleSuggestedAction = useCallback((action: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text_command', transcript: action }));
    }
    setSuggestedActions([]);
    setRespondMessage('');
    setStatus('processing');
  }, []);

  const handleDone = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setStatus('listening');
    setTranscript('');
    setPartialTranscript('');
    setActionResult('');
    setClarifyPrompt('');
    setRespondMessage('');
    setSuggestedActions([]);
    setBoardUpdateProgress(null);
    connectWebSocket();
  }, [connectWebSocket]);

  const statusText = status === 'listening'
    ? 'Type a command below'
    : status === 'processing'
    ? 'Processing...'
    : status === 'done'
    ? 'Command processed! Type another or tap Done.'
    : 'Connection error. Tap mic to retry.';

  const displayTranscript = transcript + (partialTranscript ? ' ' + partialTranscript : '');

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.closeArea} onPress={handleDone} activeOpacity={1} />

        <View style={styles.content}>
          {/* Transcript display */}
          <View style={styles.transcriptBox}>
            {clarifyPrompt ? (
              <Text style={[typography.body, styles.clarifyText]}>
                {clarifyPrompt}
              </Text>
            ) : null}

            {respondMessage ? (
              <Text style={[typography.body, styles.respondText]}>
                {respondMessage}
              </Text>
            ) : null}

            {displayTranscript ? (
              <Text style={[typography.body, styles.transcriptText]}>
                {displayTranscript}
                {status === 'listening' && <Text style={styles.cursor}>|</Text>}
              </Text>
            ) : !clarifyPrompt && !respondMessage ? (
              <Text style={[typography.body, styles.placeholderText]}>
                {status === 'error'
                  ? 'Could not connect to voice service.\nMake sure the backend is running.'
                  : 'Type a command...'}
              </Text>
            ) : null}

            {boardUpdateProgress ? (
              <View style={styles.progressSteps}>
                <Text style={styles.progressStepText}>{boardUpdateProgress.step}</Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${(boardUpdateProgress.current / boardUpdateProgress.total) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressStepCount}>
                  {boardUpdateProgress.current}/{boardUpdateProgress.total}
                </Text>
              </View>
            ) : null}

            {actionResult && !respondMessage ? (
              <Text style={[typography.body, styles.actionResultText]}>
                {actionResult}
              </Text>
            ) : null}

            {suggestedActions.length > 0 ? (
              <View style={styles.suggestedRow}>
                {suggestedActions.map((action, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestedChip}
                    onPress={() => handleSuggestedAction(action)}
                  >
                    <Text style={styles.suggestedChipText}>{action}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <Text style={[typography.caption, styles.statusText]}>{statusText}</Text>

          {/* Mic button — retry on error/done, decorative otherwise */}
          <View style={styles.micContainer}>
            {status === 'listening' && (
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            )}
            <TouchableOpacity
              style={[
                styles.micButton,
                status === 'error' && { backgroundColor: colors.danger },
                status === 'done' && { backgroundColor: colors.success },
              ]}
              onPress={status === 'error' || status === 'done' ? handleRetry : handleDone}
            >
              {status === 'listening' ? (
                <View style={styles.micWave}>
                  <View style={[styles.waveBar, styles.waveBar1]} />
                  <View style={[styles.waveBar, styles.waveBar2]} />
                  <View style={[styles.waveBar, styles.waveBar3]} />
                  <View style={[styles.waveBar, styles.waveBar2]} />
                  <View style={[styles.waveBar, styles.waveBar1]} />
                </View>
              ) : (
                <Text style={styles.micIcon}>{status === 'error' ? '!' : status === 'processing' ? '...' : '+'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Text input — primary interaction for simulator demo */}
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a voice command..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={textCommand}
              onChangeText={setTextCommand}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
              autoFocus={visible}
            />
            <TouchableOpacity
              style={[styles.sendButton, !textCommand.trim() && { opacity: 0.3 }]}
              onPress={handleSendText}
              disabled={!textCommand.trim()}
            >
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>

          {/* Done button */}
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  closeArea: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: 'center',
  },
  transcriptBox: {
    width: '100%',
    minHeight: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  transcriptText: { color: '#fff', fontSize: 20, lineHeight: 28 },
  actionResultText: { color: colors.success, fontSize: 16, lineHeight: 22, marginTop: 12, fontWeight: '500' },
  clarifyText: { color: colors.warning, fontSize: 18, lineHeight: 26, fontWeight: '600', marginBottom: 8 },
  respondText: { color: '#fff', fontSize: 18, lineHeight: 26, marginBottom: 8 },
  suggestedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  suggestedChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  suggestedChipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  placeholderText: { color: 'rgba(255,255,255,0.4)', fontSize: 18, textAlign: 'center', lineHeight: 26 },
  cursor: { color: colors.primary, fontWeight: '300' },
  statusText: { color: 'rgba(255,255,255,0.6)', marginBottom: 24 },
  micContainer: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  pulseRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,122,255,0.2)' },
  micButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  micIcon: { color: '#fff', fontSize: 24, fontWeight: '700' },
  micWave: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#fff' },
  waveBar1: { height: 12 },
  waveBar2: { height: 20 },
  waveBar3: { height: 28 },
  textInputRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  doneButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  doneText: { color: '#fff', fontSize: 17, fontWeight: '500' },
  progressSteps: { marginTop: 12 },
  progressStepText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500', marginBottom: 8 },
  progressBarContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' as const, marginBottom: 6 },
  progressBarFill: { height: '100%' as const, backgroundColor: colors.primary, borderRadius: 2 },
  progressStepCount: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'right' as const },
});
