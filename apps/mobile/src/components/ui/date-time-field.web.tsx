import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TextField } from '@/components/ui/text-field';

import type { DateTimeFieldProps } from './date-time-field';

const pad = (n: number) => String(n).padStart(2, '0');
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const format = (d: Date, mode: DateTimeFieldProps['mode']) =>
  mode === 'time'
    ? time(d)
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` + (mode === 'date' ? '' : ` ${time(d)}`);

// Web is not an MVP target: a typed "YYYY-MM-DD HH:mm" field.
export function DateTimeField({ label, value, onChange, mode, error }: DateTimeFieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(format(value, mode));
  const [invalid, setInvalid] = useState(false);

  return (
    <TextField
      label={label}
      value={text}
      error={error ?? (invalid ? t('calendar.form.invalidDate') : null)}
      placeholder={{ date: 'YYYY-MM-DD', time: 'HH:mm', datetime: 'YYYY-MM-DD HH:mm' }[mode]}
      onChangeText={(v) => {
        setText(v);
        if (mode === 'time') {
          const t = /^(\d{2}):(\d{2})$/.exec(v.trim());
          setInvalid(!t);
          if (t) onChange(new Date(2000, 0, 1, +t[1]!, +t[2]!));
          return;
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(v.trim());
        const ok = !!m && (mode === 'date' || m[4] !== undefined);
        setInvalid(!ok);
        if (ok) onChange(new Date(+m![1]!, +m![2]! - 1, +m![3]!, +(m![4] ?? 0), +(m![5] ?? 0)));
      }}
    />
  );
}
