import { toast } from 'sonner';
import { exportCopilotThread } from '@/client';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { downloadText } from './download';

/** Descarrega a conversa em Markdown; sem conversa ainda, avisa em vez de falhar. */
export async function exportThreadMarkdown(threadId: string | null): Promise<void> {
  if (!threadId) {
    toast.info(m.chat_no_thread_yet());
    return;
  }
  try {
    const { data } = await exportCopilotThread({
      path: { thread_id: threadId },
      throwOnError: true,
    });
    downloadText(data.filename, data.markdown);
  } catch (e) {
    toast.error(getErrorMessage(e));
  }
}
