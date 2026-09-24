'use client';

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type Participant } from 'livekit-client';

export type HostInfo = {
  /** the signed-in owner of this room, if the metadata says so */
  hostName: string | null;
  /** true when the local participant is that owner */
  iAmOwner: boolean;
  /** identity of the participant who holds the owner claim, if present */
  ownerIdentity: string | null;
};

function parse(meta: string | undefined): { owner?: boolean; hostName?: string | null } {
  if (!meta) return {};
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

export function useHostInfo(): HostInfo {
  const room = useRoomContext();
  const [info, setInfo] = React.useState<HostInfo>({
    hostName: null,
    iAmOwner: false,
    ownerIdentity: null,
  });

  React.useEffect(() => {
    const refresh = () => {
      const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      let hostName: string | null = null;
      let ownerIdentity: string | null = null;

      for (const p of all) {
        const m = parse(p.metadata);
        if (m.hostName && !hostName) hostName = m.hostName;
        if (m.owner) ownerIdentity = p.identity;
      }

      setInfo({
        hostName,
        ownerIdentity,
        iAmOwner: Boolean(parse(room.localParticipant.metadata).owner),
      });
    };

    refresh();
    const events = [
      RoomEvent.Connected,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantMetadataChanged,
    ];
    events.forEach((e) => room.on(e, refresh));
    return () => events.forEach((e) => room.off(e, refresh));
  }, [room]);

  return info;
}
