import { Header } from '@/components/shared/Header';
import { LibraryView } from '@/components/library/LibraryView';

export default function LibraryPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <LibraryView />
      </main>
    </>
  );
}
