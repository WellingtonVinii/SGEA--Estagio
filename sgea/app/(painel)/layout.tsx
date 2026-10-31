import Sidebar from "../components/Sidebar";
import ProtecaoAutenticacao from "../components/ProtecaoAutenticacao";

export default function PainelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtecaoAutenticacao>
    <div className="app-shell d-flex min-vh-100">
      <Sidebar />
      {children}
    </div>
  </ProtecaoAutenticacao>;
}
