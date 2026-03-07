import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Keyboard,
} from 'react-native';
import { X, Send, Bot } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';

type AiInputBarProps = {
  visible: boolean;
};

export const AiInputBar = ({ visible }: AiInputBarProps) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'processing' | 'done' | 'error'>('idle');
  const [responseMessage, setResponseMessage] = useState('');
  const [clarifyPrompt, setClarifyPrompt] = useState('');
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [boardProgress, setBoardProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const showResponse = !!(responseMessage || clarifyPrompt || boardProgress || status === 'processing');

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showResponse ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showResponse, slideAnim]);

  const connectWs = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

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

    ws.onopen = () => setStatus('idle');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'action') {
          const result = data.result || {};
          const intent = data.intent || {};

          if (intent.name === 'clarify') {
            const question = result.message || intent.args?.promptText || 'Could you clarify?';
            setClarifyPrompt(question);
            setResponseMessage('');
            setSuggestedActions([]);
            setStatus('idle');
          } else if (intent.name === 'respond') {
            const msg = intent.args?.message || result.message || '';
            const chips: string[] = intent.args?.suggestedActions || [];
            setResponseMessage(msg);
            setSuggestedActions(chips);
            setClarifyPrompt('');
            setStatus('done');
          } else {
            setClarifyPrompt('');
            setSuggestedActions([]);
            setResponseMessage(result.message || `Done: ${intent.name}`);
            setStatus(result.success ? 'done' : 'error');
          }
          setBoardProgress(null);
        } else if (data.type === 'board_update_progress') {
          setBoardProgress({
            step: data.step || 'Working...',
            current: data.current ?? 0,
            total: data.total ?? 4,
          });
          setStatus('processing');
        } else if (data.type === 'error') {
          setResponseMessage(data.message || 'Something went wrong.');
          setStatus('error');
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      wsRef.current = null;
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setResponseMessage('');
    setClarifyPrompt('');
    setSuggestedActions([]);
    setBoardProgress(null);
    setStatus('connecting');

    const send = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text_command', transcript: trimmed }));
        setStatus('processing');
      } else {
        setStatus('error');
        setResponseMessage('Could not connect to AI service.');
      }
    };

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWs().then(() => {
        // Give a moment for the connection to establish
        setTimeout(send, 500);
      });
    } else {
      send();
    }

    setText('');
    Keyboard.dismiss();
  }, [text, connectWs]);

  const handleSuggestedAction = useCallback((action: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text_command', transcript: action }));
    }
    setSuggestedActions([]);
    setResponseMessage('');
    setClarifyPrompt('');
    setStatus('processing');
  }, []);

  const dismissResponse = useCallback(() => {
    setResponseMessage('');
    setClarifyPrompt('');
    setSuggestedActions([]);
    setBoardProgress(null);
    setStatus('idle');
  }, []);

  const responseMaxHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Response Card */}
      <Animated.View style={[styles.responseWrapper, { maxHeight: responseMaxHeight, opacity: slideAnim }]}>
        {showResponse && (
          <View style={styles.responseCard}>
            <View style={styles.responseHeader}>
              <View style={styles.responseHeaderLeft}>
                <Bot color={colors.primary} size={14} />
                <Text style={styles.responseLabel}>
                  {status === 'processing' ? 'Thinking...' : 'AI'}
                </Text>
              </View>
              <TouchableOpacity onPress={dismissResponse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={colors.textSecondary} size={16} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.responseScroll} showsVerticalScrollIndicator={false}>
              {clarifyPrompt ? (
                <Text style={styles.clarifyText}>{clarifyPrompt}</Text>
              ) : null}

              {responseMessage ? (
                <Text style={styles.responseText}>{responseMessage}</Text>
              ) : null}

              {boardProgress ? (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressStep}>{boardProgress.step}</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${(boardProgress.current / boardProgress.total) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressCount}>
                    {boardProgress.current}/{boardProgress.total}
                  </Text>
                </View>
              ) : null}

              {status === 'processing' && !boardProgress && !responseMessage ? (
                <Text style={styles.processingText}>Processing your request...</Text>
              ) : null}
            </ScrollView>

            {suggestedActions.length > 0 ? (
              <View style={styles.chipsRow}>
                {suggestedActions.map((action, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.chip}
                    onPress={() => handleSuggestedAction(action)}
                  >
                    <Text style={styles.chipText}>{action}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </Animated.View>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Ask AI..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Send color={text.trim() ? '#fff' : colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // Response card
  responseWrapper: {
    overflow: 'hidden',
  },
  responseCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  responseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  responseScroll: {
    maxHeight: 100,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  clarifyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: '500',
  },
  processingText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // Board update progress
  progressContainer: {
    marginTop: 4,
  },
  progressStep: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  // Suggested action chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#C0C0C8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8E8ED',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#48484A',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundLight,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.backgroundLight,
  },
});
