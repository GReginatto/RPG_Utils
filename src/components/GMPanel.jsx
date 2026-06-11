import { useRole } from '../hooks/useRole';
import IframeModal from './IframeModal';

export default function GMPanel({ onClose, zIndex, onFocus }) {
  const { isGM } = useRole();
  if (!isGM) return null;
  return (
    <IframeModal
      src="/painel-mestre.html"
      title="🎭 Painel do Mestre"
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
    />
  );
}
