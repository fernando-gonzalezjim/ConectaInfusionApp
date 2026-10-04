import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocaleProvider, useLocale } from '@conecta/i18n';
import { App } from './App';
import '@conecta/ui/styles.css';
import { createApiClient } from '@conecta/api-client';
import { IdentityActionPage, isActionPage } from '@conecta/ui/components/identity-action-page';
const api = createApiClient();
function Root() { const { t, locale, setLocale } = useLocale(); return isActionPage ? <IdentityActionPage api={api} t={t} locale={locale} setLocale={setLocale} /> : <App />; }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LocaleProvider><Root /></LocaleProvider></React.StrictMode>);
