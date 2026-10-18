import { useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react';
import { RoastModePicker } from './RoastModePicker';
import type { ReroastOptions, RoastLanguage, RoastLevel } from '../../types';

export interface ReroastDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialLevel: RoastLevel;
  initialLanguage: RoastLanguage;
  onConfirm: (options: ReroastOptions) => void;
  isLoading?: boolean;
}

/** Lets the user re-roast with the same or a different level/language. */
export function ReroastDialog({ isOpen, onClose, initialLevel, initialLanguage, onConfirm, isLoading }: ReroastDialogProps) {
  const [level, setLevel] = useState<RoastLevel>(initialLevel);
  const [language, setLanguage] = useState<RoastLanguage>(initialLanguage);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="xl"
      onCloseComplete={() => {
        setLevel(initialLevel);
        setLanguage(initialLanguage);
      }}
    >
      <ModalOverlay />
      <ModalContent bg="bg.surface">
        <ModalHeader>Re-roast this repo</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text color="text.muted" fontSize="sm" mb={5}>
            Fetches the latest code and roasts it again. Uses one roast from today&apos;s quota. Scores don&apos;t
            depend on the level; only the tone changes.
          </Text>
          <RoastModePicker
            level={level}
            language={language}
            onLevelChange={setLevel}
            onLanguageChange={setLanguage}
            isDisabled={isLoading}
          />
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ roast_level: level, roast_language: language })}
            isLoading={isLoading}
            loadingText="Starting"
          >
            Start re-roast
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default ReroastDialog;
