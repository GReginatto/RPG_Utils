import { RoleProvider, useRole } from './hooks/useRole';
import RoleSelector from './components/RoleSelector';
import TabletopMap from './TabletopMap';

function AppInner() {
  const { role } = useRole();
  if (role === null) return <RoleSelector />;
  return <TabletopMap />;
}

function App() {
  return (
    <RoleProvider>
      <AppInner />
    </RoleProvider>
  );
}

export default App;
