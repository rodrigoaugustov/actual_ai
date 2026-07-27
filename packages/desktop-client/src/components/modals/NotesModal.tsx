// @ts-strict-ignore
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheck } from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { Notes } from '#components/Notes';
import { useNotes } from '#hooks/useNotes';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { nossoCaderninho } from '#style/nossoCaderninho';

type NotesModalProps = Extract<ModalType, { name: 'notes' }>['options'];

export function NotesModal({
  id,
  name,
  title,
  description,
  placeholder,
  saveLabel,
  maxLength,
  onSave,
}: NotesModalProps) {
  const { t } = useTranslation();
  const originalNotes = useNotes(id);

  const [notes, setNotes] = useState(originalNotes);
  useEffect(() => setNotes(originalNotes), [originalNotes]);

  function _onSave() {
    if (notes !== originalNotes) {
      onSave?.(id, notes);
    }
  }

  return (
    <Modal
      name="notes"
      containerProps={{
        style: { height: '50vh' },
      }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={title ?? t('Notes: {{name}}', { name })}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
            }}
          >
            {description && (
              <Text
                style={{
                  color: nossoCaderninho.color.graphiteSubdued,
                  marginBottom: nossoCaderninho.space.sm,
                }}
              >
                {description}
              </Text>
            )}
            <Notes
              notes={notes}
              editable
              focused
              placeholder={placeholder}
              maxLength={maxLength}
              getStyle={() => ({
                borderRadius: 6,
                flex: 1,
                minWidth: 0,
              })}
              onChange={setNotes}
            />
            <View
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                justifyItems: 'center',
                width: '100%',
                paddingTop: 10,
              }}
            >
              <Button
                variant="primary"
                style={{
                  fontSize: 17,
                  fontWeight: 400,
                  width: '100%',
                }}
                onPress={() => {
                  _onSave();
                  state.close();
                }}
              >
                <SvgCheck width={17} height={17} style={{ paddingRight: 5 }} />
                {saveLabel ?? <Trans>Save notes</Trans>}
              </Button>
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}
