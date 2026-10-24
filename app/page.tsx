import { explorerContent } from '@/content/bundle';
import { Experience } from '@/ui/Experience';

export default function Home() {
  return <Experience intro content={explorerContent()} />;
}
