import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { getApiErrorMessage } from '../api/errors';

interface ReasonField {
  label: string;
  /** Minimum length enforced before the confirm button is enabled (mirrors the API rule). */
  minLength: number;
  maxLength?: number | undefined;
  helper?: string | undefined;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode | undefined;
  /** Read-only summary of the affected record (code, name, current state…). */
  summary?: ReactNode | undefined;
  confirmLabel: string;
  /** Destructive actions use the error color and never get initial focus. */
  destructive?: boolean | undefined;
  reason?: ReasonField | undefined;
  pending?: boolean;
  error?: unknown;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}

/**
 * Accessible confirmation for state changes: explicit action label, optional mandatory
 * justification, visible progress and protection against double submission. The backend still
 * validates the transition; this only prevents accidental or incomplete requests.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  summary,
  confirmLabel,
  destructive = false,
  reason,
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      setValue('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = value.trim();
  const reasonInvalid = Boolean(reason) && trimmed.length < (reason?.minLength ?? 0);
  const submit = () => {
    setTouched(true);
    if (pending || reasonInvalid) return;
    onConfirm(reason ? trimmed : undefined);
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {description && (
          <DialogContentText id={descriptionId} sx={{ mb: summary || reason ? 2 : 0 }}>
            {description}
          </DialogContentText>
        )}
        {summary}
        {reason && (
          <TextField
            label={reason.label}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setTouched(true)}
            required
            fullWidth
            multiline
            minRows={3}
            autoFocus
            sx={{ mt: summary ? 2.5 : 0 }}
            error={touched && reasonInvalid}
            helperText={
              touched && reasonInvalid
                ? `Escriba al menos ${reason.minLength} caracteres (${trimmed.length}/${reason.minLength}).`
                : (reason.helper ??
                  `Mínimo ${reason.minLength} caracteres. Quedará en la auditoría.`)
            }
            slotProps={{ htmlInput: { maxLength: reason.maxLength ?? 1000 } }}
          />
        )}
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {getApiErrorMessage(error)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={pending} autoFocus={!reason && destructive}>
          Volver
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={submit}
          disabled={pending || (touched && reasonInvalid)}
          aria-busy={pending}
          startIcon={
            pending ? <CircularProgress size={16} color="inherit" aria-hidden /> : undefined
          }
        >
          {pending ? 'Procesando…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
