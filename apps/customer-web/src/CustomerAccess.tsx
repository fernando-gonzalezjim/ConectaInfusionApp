import { createApiClient } from '@conecta/api-client';
import { useAccountLabels, useLocale } from '@conecta/i18n';
import { AccountAccess } from '@conecta/ui/components/account-access';
import { RecoveryRequest } from '@conecta/ui/components/password-recovery';
import { RegistrationAccess } from './RegistrationAccess';
import { useCallback, useState } from 'react';
import type { PublicAccount } from '@conecta/contracts';

const api = createApiClient();
export function CustomerAccess() {
  const { t } = useLocale();
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const changed = useCallback((value: PublicAccount | null) => setAccount(value), []);
  return <div className="flex flex-wrap gap-3"><AccountAccess api={api} labels={useAccountLabels()} onAccountChange={changed} />{!account && <><RegistrationAccess /><RecoveryRequest api={api} t={t} /></>}</div>;
}
