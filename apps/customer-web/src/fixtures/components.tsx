// Vite development-only fixture. Not imported by the application entry/build.
import { createRoot } from 'react-dom/client';
import { Button } from '@conecta/ui/components/button';
import { Input } from '@conecta/ui/components/input';
import { FieldError } from '@conecta/ui/components/field-error';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@conecta/ui/components/dialog';
import '@conecta/ui/styles.css';

const english = new URLSearchParams(location.search).get('lang') === 'en';
document.documentElement.lang = english ? 'en' : 'es-MX';

createRoot(document.getElementById('root')!).render(
  <main className="mx-auto grid max-w-lg gap-4 p-6">
    <h1 className="text-2xl">{english ? 'Shared components' : 'Componentes compartidos'}</h1>
    <label htmlFor="name">{english ? 'Full name of the person making this request' : 'Nombre completo de la persona que realiza esta solicitud'}</label>
    <Input id="name" aria-invalid="true" aria-describedby="name-error" />
    <FieldError id="name-error">{english ? 'Enter your full name.' : 'Escribe tu nombre completo.'}</FieldError>
    <Dialog>
      <DialogTrigger asChild><Button>{english ? 'Open details' : 'Abrir detalles'}</Button></DialogTrigger>
      <DialogContent closeLabel={english ? 'Close' : 'Cerrar'}>
        <DialogTitle>{english ? 'Request details' : 'Detalles de la solicitud'}</DialogTitle>
        <DialogDescription>{english ? 'Your entries stay in the form when you close this dialog.' : 'Los datos que escribiste permanecen en el formulario al cerrar este diálogo.'}</DialogDescription>
      </DialogContent>
    </Dialog>
  </main>
);
