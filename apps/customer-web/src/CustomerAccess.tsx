import { createApiClient } from '@conecta/api-client';
import { useAccountLabels, useLocale } from '@conecta/i18n';
import { AccountAccess } from '@conecta/ui/components/account-access';
import { RecoveryRequest } from '@conecta/ui/components/password-recovery';
import { RegistrationAccess } from './RegistrationAccess';
import { useCallback, useState } from 'react';
import type { PublicAccount } from '@conecta/contracts';
import { SelfProfile } from '@conecta/ui/components/self-profile';
import {FamilyAccess} from '@conecta/ui/components/family-access';

const api = createApiClient();
export function CustomerAccess() {
  const { t } = useLocale();
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [epoch,setEpoch]=useState(0);
  const changed = useCallback((value: PublicAccount | null) => setAccount(value), []);
  const accessLost=useCallback(()=>{setAccount(null);setEpoch(value=>value+1);},[]);
  return <div className="flex flex-wrap gap-3"><AccountAccess key={epoch} api={api} labels={useAccountLabels()} onAccountChange={changed}
    renderProfile={(value,onSaved,onPending,onAccessLost)=><SelfProfile api={api} account={value} t={t} onSaved={onSaved} onPending={onPending} onAccessLost={onAccessLost} />} />
    {account?.roles.includes('customer')&&<FamilyAccess key={account.id} api={api} account={account} t={t} onAccessLost={accessLost} />}
    {!account && <><RegistrationAccess /><RecoveryRequest api={api} t={t} /></>}</div>;
}
