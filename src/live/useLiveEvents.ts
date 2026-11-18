import { useEffect, useRef } from 'react';
import type { LiveHandlers } from './types';
import { IS_STAGE, STAGE_ID } from './page';
import { voice } from './voice';
import { openEvents } from './api';

/**
 * Listens to live events from the server. The handler is always the latest one (no stale state),
 * and it reconnects by itself after a network drop.
 */
export function useLiveEvents(handlers: LiveHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const on = (name: string, fn: (data: any) => void) =>
      source!.addEventListener(name, (e) => {
        try {
          fn(JSON.parse((e as MessageEvent).data));
        } catch (err) {
          console.warn(`Error handling event ${name}:`, err);
        }
      });

    const connect = () => {
      source = openEvents(IS_STAGE ? `/api/tiktok/events?stage=${STAGE_ID}` : '/api/tiktok/events');
      on('status', (d) => ref.current.onStatus?.(d));
      on('chat', (d) => ref.current.onChat?.(d));
      on('gift', (d) => ref.current.onGift?.(d));
      on('member', (d) => ref.current.onMember?.(d));
      on('follow', (d) => ref.current.onFollow?.(d));
      on('share', (d) => ref.current.onShare?.(d));
      on('like', (d) => ref.current.onLike?.(d));
      on('roomUser', (d) => ref.current.onViewers?.(d.viewerCount));
      on('control', (d) => ref.current.onControl?.(d));
      on('roomCfg', (d) => ref.current.onRoomCfg?.(d));
      on('gamestate', (d) => ref.current.onGameState?.(d));
      on('speaker', (d) => {
        // this stage page was replaced by a newer one: go fully silent (voice and music)
        if (IS_STAGE) {
          const mine = d.id === STAGE_ID;
          if (!mine && voice.enabled) voice.stop();
          voice.enabled = mine;
        }
        ref.current.onSpeaker?.(d);
      });
      source.onerror = () => {
        source?.close();
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      source?.close();
    };
  }, []);
}
