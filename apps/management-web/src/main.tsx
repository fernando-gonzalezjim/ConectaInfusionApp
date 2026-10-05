import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocaleProvider, useLocale, useAccountLabels } from '@conecta/i18n';
import { App } from './App';
import '@conecta/ui/styles.css';
import { createApiClient } from '@conecta/api-client';
import { IdentityActionPage, isActionPage } from '@conecta/ui/components/identity-action-page';
import {GuardianInvitation} from '@conecta/ui/components/guardian-invitation';
import {FamilyInvitation} from '@conecta/ui/components/family-invitation';
const api = createApiClient();
function Root() { const { t, locale, setLocale } = useLocale(); const labels=useAccountLabels();return isActionPage ? <IdentityActionPage api={api} t={t} locale={locale} setLocale={setLocale}
  renderGuardianInvitation={(token,onCompleted,onInvalid)=><GuardianInvitation api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid}/>}
    renderFamilySuccessor={(token,onCompleted,onInvalid)=><FamilyInvitation purpose="responsibility" api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid} />}
    renderFamilyInvitation={(token,onCompleted,onInvalid)=><FamilyInvitation api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid} />} /> : <App />; }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LocaleProvider><Root /></LocaleProvider></React.StrictMode>);
