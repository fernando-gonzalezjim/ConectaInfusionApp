import React from 'react';
import ReactDOM from 'react-dom/client';
import { FoundationApp } from './FoundationApp';
import { CustomerActionPage } from './RegistrationAccess';
import { isActionPage } from '@conecta/ui/components/identity-action-page';
import { LocaleProvider } from '@conecta/i18n';
import '@conecta/ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LocaleProvider>{isActionPage ? <CustomerActionPage /> : <FoundationApp />}</LocaleProvider></React.StrictMode>);
