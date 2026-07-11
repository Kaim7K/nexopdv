import { Link } from 'react-router-dom';
import { usePageMetadata } from '@/hooks/use-page-metadata';

export default function PageNotFound() {
  usePageMetadata({ title: 'Página não encontrada | Nexo PDV', description: 'O endereço informado não existe.', robots: 'noindex, nofollow' });
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-6">
      <div className="max-w-md text-center">
        <p className="text-7xl font-light text-muted-foreground/30">404</p>
        <h1 className="mt-4 text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-2 text-muted-foreground">O endereço informado não existe no Nexo PDV.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-bold text-accent-foreground">Voltar ao início</Link>
      </div>
    </main>
  );
}
