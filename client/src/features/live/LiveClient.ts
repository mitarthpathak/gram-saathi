import type { ChatQueryRequest } from '@gram-saathi/shared';
import { config } from '@/lib/config';
import type { LiveTokenRequest, LiveTokenResponse } from './liveTypes';
import { convertToPcm16, LIVE_OUTPUT_RATE, parseLiveMessage, type LiveEvent } from './liveProtocol';
import captureWorkletUrl from './capture.worklet.js?url&no-inline';

export interface LiveClientCallbacks {
  onEvent: (event: LiveEvent) => void;
  onToolQuestion: (question: string) => Promise<{ answer: string; fraudWarning: string }>;
  onPlaybackEnded: () => void;
}

export class LiveClient {
  private socket: WebSocket | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private muteGain: GainNode | null = null;
  private playbackSources = new Set<AudioBufferSourceNode>();
  private playbackCursor = 0;
  private intentionalClose = false;
  private streaming = false;
  private inputLevel = 0;
  private readonly callbacks: LiveClientCallbacks;

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(token: LiveTokenResponse): Promise<void> {
    const url = new URL(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
    );
    url.searchParams.set('access_token', token.token);
    const socket = new WebSocket(url.toString());
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Live connection timed out'));
        socket.close();
      }, 20_000);
      let configured = false;
      socket.onopen = () => {
        const setup = {
          model: `models/${token.model}`,
          responseModalities: ['AUDIO'],
          ...(token.setup ?? {}),
        };
        socket.send(JSON.stringify({ setup }));
      };
      socket.onmessage = (message) => {
        const raw = typeof message.data === 'string' ? message.data : undefined;
        if (!raw) return;
        for (const event of parseLiveMessage(raw)) {
          this.handleEvent(event);
          if (event.type === 'setupComplete' && !configured) {
            configured = true;
            window.clearTimeout(timeout);
            resolve();
          }
        }
      };
      socket.onerror = () => {
        window.clearTimeout(timeout);
        if (!configured) reject(new Error('Live connection failed'));
        this.callbacks.onEvent({ type: 'error' });
      };
      socket.onclose = () => {
        window.clearTimeout(timeout);
        if (!configured) reject(new Error('Live connection closed before setup'));
        if (!this.intentionalClose) this.callbacks.onEvent({ type: 'error' });
      };
    });
  }

  async prepareAudio(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.inputContext = new AudioContext({ sampleRate: 16_000 });
    this.outputContext = new AudioContext({ sampleRate: LIVE_OUTPUT_RATE });
    await Promise.all([
      this.inputContext.audioWorklet.addModule(captureWorkletUrl),
      this.inputContext.resume(),
      this.outputContext.resume(),
    ]);
    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.captureNode = new AudioWorkletNode(this.inputContext, 'gram-saathi-live-capture');
    this.muteGain = this.inputContext.createGain();
    this.muteGain.gain.value = 0;
    this.source.connect(this.captureNode);
    this.captureNode.connect(this.muteGain);
    this.muteGain.connect(this.inputContext.destination);
    this.captureNode.port.onmessage = (message: MessageEvent<Float32Array>) => {
      const socket = this.socket;
      const samples = message.data;
      let power = 0;
      for (let index = 0; index < samples.length; index++) power += samples[index] * samples[index];
      this.inputLevel = Math.min(1, Math.sqrt(power / Math.max(1, samples.length)) * 4);
      if (!this.streaming || !socket || socket.readyState !== WebSocket.OPEN) return;
      const pcm = convertToPcm16(samples, this.inputContext?.sampleRate ?? 16_000);
      socket.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: arrayBufferToBase64(pcm), mimeType: 'audio/pcm;rate=16000' },
          },
        }),
      );
    };
  }

  startMicrophone(): void {
    this.streaming = true;
  }

  getLevel = (): number => {
    return this.stream?.active ? this.inputLevel : 0;
  };

  sendToolResponse(
    id: string,
    name: string,
    response: { answer: string; fraudWarning: string },
  ): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [{ id, name, response }],
        },
      }),
    );
  }

  close(): void {
    this.intentionalClose = true;
    this.streaming = false;
    this.inputLevel = 0;
    this.captureNode?.port.close();
    this.source?.disconnect();
    this.captureNode?.disconnect();
    this.muteGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stopPlayback();
    if (this.inputContext && this.inputContext.state !== 'closed') void this.inputContext.close();
    if (this.outputContext && this.outputContext.state !== 'closed')
      void this.outputContext.close();
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
    this.socket = null;
    this.stream = null;
    this.source = null;
    this.captureNode = null;
    this.muteGain = null;
    this.inputContext = null;
    this.outputContext = null;
  }

  private handleEvent(event: LiveEvent): void {
    if (event.type === 'audio') this.playAudio(event.data);
    else if (event.type === 'interrupted') this.stopPlayback();
    else if (event.type === 'toolCall') void this.handleToolCall(event);
    else if (event.type === 'turnComplete' && this.playbackSources.size === 0) {
      this.callbacks.onPlaybackEnded();
    }
    this.callbacks.onEvent(event);
  }

  private async handleToolCall(event: Extract<LiveEvent, { type: 'toolCall' }>): Promise<void> {
    if (event.name !== 'ask_gram_saathi') {
      this.sendToolResponse(event.id, event.name, { answer: '', fraudWarning: '' });
      return;
    }
    const question = event.args.question;
    if (typeof question !== 'string' || !question.trim()) {
      this.sendToolResponse(event.id, event.name, { answer: '', fraudWarning: '' });
      return;
    }
    try {
      const result = await this.callbacks.onToolQuestion(question.trim());
      this.sendToolResponse(event.id, event.name, result);
    } catch {
      this.sendToolResponse(event.id, event.name, { answer: '', fraudWarning: '' });
      this.callbacks.onEvent({ type: 'error' });
    }
  }

  private playAudio(base64: string): void {
    const context = this.outputContext;
    if (!context || context.state === 'closed') return;
    const bytes = base64ToBytes(base64);
    const sampleCount = Math.floor(bytes.byteLength / 2);
    if (!sampleCount) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = context.createBuffer(1, sampleCount, LIVE_OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index++) {
      channel[index] = view.getInt16(index * 2, true) / 0x8000;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, this.playbackCursor);
    source.onended = () => {
      this.playbackSources.delete(source);
      source.disconnect();
      if (this.playbackSources.size === 0) this.callbacks.onPlaybackEnded();
    };
    this.playbackSources.add(source);
    source.start(startAt);
    this.playbackCursor = startAt + buffer.duration;
  }

  private stopPlayback(): void {
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {
        // A source can finish between interruption and stop().
      }
      source.disconnect();
    }
    this.playbackSources.clear();
    this.playbackCursor = this.outputContext?.currentTime ?? 0;
  }
}

export async function requestLiveToken(request: LiveTokenRequest): Promise<LiveTokenResponse> {
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/api/live/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('Live token request failed');
  }
  if (!response.ok) throw new Error('Live token request failed');
  return (await response.json()) as LiveTokenResponse;
}

export function chatToolRequest(
  question: string,
  request: LiveTokenRequest,
  chatQuery: (body: ChatQueryRequest) => Promise<{ answer: string; fraudWarning: string }>,
): Promise<{ answer: string; fraudWarning: string }> {
  return chatQuery({
    text: question,
    sessionId: request.sessionId,
    language: request.language,
    dialectHint: request.dialectHint,
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
