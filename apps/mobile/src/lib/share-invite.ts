import { inviteUrl } from '@family-hub/core';
import type { Invite } from '@family-hub/data';
import type { TFunction } from 'i18next';

export function inviteShareMessage(t: TFunction, invite: Pick<Invite, 'token' | 'code'>) {
  return t('invite.create.shareMessage', { url: inviteUrl(invite.token), code: invite.code });
}
