import { useQueryClient } from '@tanstack/react-query';
/*
 * Copyright (c) 2022 FLECS Technologies GmbH
 *
 * Created on Fri Dec 09 2022
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from 'react';
import { toast } from 'sonner';
import { Archive, Check, FolderUp, Server } from 'lucide-react';
import FileOpen from '@app/components/FileOpen';
import { useFileDrop } from '@app/components/useFileDrop';

import { useQuestActions } from '@features/notifications/quests/hooks';
import { questStateFinishedOk } from '@features/notifications/quests/QuestItem';
import { usePostDeviceOnboarding } from '@generated/core/device/device';
import { usePostImports } from '@generated/core/flecsport/flecsport';
import { getGetQuestsQueryKey } from '@generated/core/quests/quests';
import { unwrapSuccess } from '@app/api/unwrap';
import { getErrorMessage } from '@app/api/fetch-error';
import { LONG_REQUEST_TIMEOUT_MS } from '@app/api/request-timeout';

interface ImportProps extends React.ComponentProps<'button'> {
  /** Render as a drag-and-drop zone (dashed container) instead of a bare button. */
  dropzone?: boolean;
  buttonText?: string;
  onImportStarted?: () => void;
  onHandoffPhaseChange?: (phase: ImportHandoffPhase) => void;
  mode: 'restore' | 'onboard';
}

export type ImportHandoffPhase = 'idle' | 'uploading' | 'accepted';

type ImportHandoffState =
  | { phase: 'idle' }
  | { phase: Exclude<ImportHandoffPhase, 'idle'>; fileName: string };

function ImportHandoff({
  state,
  mode,
  onConfirmationComplete,
}: {
  state: ImportHandoffState;
  mode: ImportProps['mode'];
  onConfirmationComplete: () => void;
}) {
  React.useEffect(() => {
    if (
      state.phase === 'accepted' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      onConfirmationComplete();
    }
  }, [onConfirmationComplete, state.phase]);

  if (state.phase === 'idle') return null;

  const isAccepted = state.phase === 'accepted';
  const title = isAccepted
    ? mode === 'restore'
      ? 'Restore job started'
      : 'Onboarding job started'
    : mode === 'restore'
      ? 'Uploading backup'
      : 'Uploading apps.json';
  const description = isAccepted
    ? 'The device accepted the file. Continue tracking progress in Jobs.'
    : 'Waiting for this device to accept the file.';

  return (
    <div
      data-testid="import-handoff"
      role="status"
      aria-live="polite"
      className="relative min-h-52 overflow-hidden rounded-xl border border-brand/20 bg-brand/3 px-6 py-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--color-brand)_10%,transparent),transparent_62%)]" />
      <div className="relative mx-auto max-w-sm text-center">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3" aria-hidden="true">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/20 bg-surface-raised text-brand shadow-sm">
            <Archive size={18} />
          </span>
          <span
            className={`relative h-1 overflow-hidden rounded-full ${isAccepted ? 'bg-success' : 'bg-border'}`}
          >
            {!isAccepted && (
              <span className="absolute inset-y-0 w-2/5 animate-[import-handoff-travel_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-brand to-transparent motion-reduce:animate-none motion-reduce:left-[30%]" />
            )}
          </span>
          <span
            className={`grid h-10 w-10 place-items-center rounded-xl border bg-surface-raised shadow-sm transition-colors duration-300 ${
              isAccepted ? 'border-success/30 text-success' : 'border-brand/20 text-brand'
            }`}
          >
            {isAccepted ? (
              <Check
                data-testid="import-confirmation"
                size={19}
                strokeWidth={2.5}
                className="animate-[import-handoff-confirm_350ms_ease-out] motion-reduce:animate-none"
                onAnimationEnd={onConfirmationComplete}
              />
            ) : (
              <Server size={18} />
            )}
          </span>
        </div>

        <p className={`mt-5 text-sm font-semibold ${isAccepted ? 'text-success' : ''}`}>{title}</p>
        <p className="mt-1 truncate text-xs font-medium text-text-secondary" title={state.fileName}>
          {state.fileName}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>

        {!isAccepted && (
          <div className="mx-auto mt-5 w-3/4 space-y-2" aria-hidden="true">
            <span className="block h-1.5 w-full animate-pulse rounded-full bg-brand/15 motion-reduce:animate-none" />
            <span className="mx-auto block h-1.5 w-2/3 animate-pulse rounded-full bg-brand/10 motion-reduce:animate-none" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Import(props: ImportProps) {
  const qc = useQueryClient();
  const { fetchQuest, waitForQuest } = useQuestActions();
  const onboardingMutation = usePostDeviceOnboarding();
  const backupMutation = usePostImports({
    request: { timeout: LONG_REQUEST_TIMEOUT_MS },
  });
  const dropzoneInputRef = React.useRef<HTMLInputElement>(null);
  const confirmationResolverRef = React.useRef<(() => void) | null>(null);
  const [handoff, setHandoff] = React.useState<ImportHandoffState>({ phase: 'idle' });
  const { dropzone, mode, onImportStarted, onHandoffPhaseChange, ...buttonProps } = props;
  const buttonText = props.buttonText ?? (mode === 'restore' ? 'Restore backup' : 'Onboard device');
  const accept = mode === 'restore' ? '.tar.gz, .tar' : '.json';
  const importing =
    handoff.phase !== 'idle' || onboardingMutation.isPending || backupMutation.isPending;

  const updateHandoff = (state: ImportHandoffState) => {
    setHandoff(state);
    onHandoffPhaseChange?.(state.phase);
  };

  const completeConfirmation = React.useCallback(() => {
    confirmationResolverRef.current?.();
    confirmationResolverRef.current = null;
  }, []);

  const showAcceptedHandoff = async (fileName: string) => {
    const confirmationComplete = new Promise<void>((resolve) => {
      confirmationResolverRef.current = resolve;
    });

    updateHandoff({ phase: 'accepted', fileName });
    await Promise.all([
      qc.refetchQueries({ queryKey: getGetQuestsQueryKey(), exact: true, type: 'active' }),
      confirmationComplete,
    ]);
  };

  const handleFileUpload = (file: string | File) => {
    // wholeFile=true on <FileOpen /> guarantees File, not string; narrow for TS.
    if (typeof file === 'string' || !file) return;
    const fileName = file.name.toLowerCase();
    if (mode === 'restore' && (fileName.endsWith('.tar.gz') || fileName.endsWith('.tar'))) {
      updateHandoff({ phase: 'uploading', fileName: file.name });
      handleTarFile(file);
    } else if (mode === 'onboard' && fileName.endsWith('.json')) {
      updateHandoff({ phase: 'uploading', fileName: file.name });
      handleJsonFile(file);
    } else {
      const message =
        mode === 'restore'
          ? 'Please upload a .tar or .tar.gz backup.'
          : 'Please upload an apps.json file.';
      toast.error('Unsupported file type', { description: message });
    }
  };

  const handleJsonFile = async (file: File) => {
    let handedOff = false;
    try {
      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);

      const onboardingQuest = await onboardingMutation.mutateAsync({ data: jsonData });
      const onboardingData = unwrapSuccess(onboardingQuest);
      if (!onboardingData) throw new Error('Onboarding request failed');
      await fetchQuest(onboardingData.jobId);
      await showAcceptedHandoff(file.name);
      handedOff = onImportStarted !== undefined;
      onImportStarted?.();
      const result = await waitForQuest(onboardingData.jobId);

      if (!questStateFinishedOk(result.state)) throw new Error(result.description);

      toast.success('Device onboarding finished successfully');
      if (!handedOff) updateHandoff({ phase: 'idle' });
    } catch (error: unknown) {
      if (!handedOff) updateHandoff({ phase: 'idle' });
      toast.error('Onboarding failed', { description: getErrorMessage(error) });
    } finally {
      qc.invalidateQueries();
    }
  };

  const handleTarFile = async (file: File) => {
    let handedOff = false;
    try {
      const importQuest = await backupMutation.mutateAsync({ data: { file } });
      const importData = unwrapSuccess(importQuest);
      if (!importData) throw new Error('Import request failed');
      await fetchQuest(importData.jobId);
      await showAcceptedHandoff(file.name);
      handedOff = onImportStarted !== undefined;
      onImportStarted?.();
      const result = await waitForQuest(importData.jobId);

      if (!questStateFinishedOk(result.state)) throw new Error(result.description);

      toast.success('Backup restored successfully');
      if (!handedOff) updateHandoff({ phase: 'idle' });
    } catch (error: unknown) {
      if (!handedOff) updateHandoff({ phase: 'idle' });
      toast.error('Restore failed', { description: getErrorMessage(error) });
    } finally {
      qc.invalidateQueries();
    }
  };

  // handleFileUpload validates the extension and toasts on mismatch,
  // so the dropzone accepts any file and defers validation.
  const { isDragOver, dropProps } = useFileDrop({
    onFile: handleFileUpload,
    disabled: buttonProps.disabled || importing,
  });

  const button = (
    <FileOpen
      {...buttonProps}
      data-testid="import-apps-button"
      buttonText={buttonText}
      buttonIcon={<FolderUp size={16} />}
      accept={accept}
      onConfirm={handleFileUpload}
      loading={importing}
      wholeFile={true}
      disabled={buttonProps.disabled || importing}
    ></FileOpen>
  );

  if (!dropzone) return button;

  if (handoff.phase !== 'idle') {
    return (
      <ImportHandoff state={handoff} mode={mode} onConfirmationComplete={completeConfirmation} />
    );
  }

  return (
    <>
      <input
        ref={dropzoneInputRef}
        data-testid="fileInput"
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) handleFileUpload(file);
        }}
      />
      <div
        data-testid="import-dropzone"
        role="button"
        tabIndex={0}
        aria-label={buttonText}
        onClick={() => dropzoneInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            dropzoneInputRef.current?.click();
          }
        }}
        {...dropProps}
        className={`px-5 rounded-xl border border-dashed flex cursor-pointer items-center gap-4 hover:border-brand hover:bg-brand/3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${isDragOver ? 'border-brand bg-brand/3' : 'border-border'}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <FolderUp size={18} />
        </div>
        <span className="text-sm font-semibold text-brand">{buttonText}</span>
      </div>
    </>
  );
}
