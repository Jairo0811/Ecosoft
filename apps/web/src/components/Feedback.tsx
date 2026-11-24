import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'success' | 'info' | 'warning' | 'error';
interface Message {
  id: number;
  text: string;
  severity: Severity;
}

const FeedbackContext = createContext<((text: string, severity?: Severity) => void) | null>(null);

/** One polite toast at a time; it confirms what changed, using the same verb as the action. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const notify = useCallback((text: string, severity: Severity = 'success') => {
    setMessage({ id: Date.now(), text, severity });
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        key={message?.id}
        open={Boolean(message)}
        autoHideDuration={message?.severity === 'error' ? 8000 : 5000}
        onClose={(_event, reason) => reason !== 'clickaway' && setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {message ? (
          <Alert
            severity={message.severity}
            variant="filled"
            onClose={() => setMessage(null)}
            role={message.severity === 'error' ? 'alert' : 'status'}
            sx={{ minWidth: 280 }}
          >
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </FeedbackContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useNotify debe utilizarse dentro de FeedbackProvider.');
  return context;
}
