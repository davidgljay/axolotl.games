import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./src/index.css";
import Home from "./src/home";
import AxolotlCakeRun from "./src/axolotl_cake_run";
import AxolotlCharacterCreator from "./src/axolotl_character_creator";
import AxolotlDriver from "./src/axolotl_driving_game";
import AxolotlClickerGame from "./src/axolotl_clicker_game";

type View = 'home' | 'cake-run' | 'character-creator' | 'axolotl-driving-game' | 'axolotl-clickr';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');

  const navigateTo = (view: View) => {
    setCurrentView(view);
  };

  const navigateBack = () => {
    setCurrentView('home');
  };

  switch (currentView) {
    case 'cake-run':
      return <AxolotlCakeRun onBack={navigateBack} />;
    case 'character-creator':
      return <AxolotlCharacterCreator onBack={navigateBack} />;
    case 'axolotl-driving-game':
      return <AxolotlDriver onBack={navigateBack} />;
    case 'axolotl-clickr':
      return <AxolotlClickerGame onBack={navigateBack} />;
    case 'home':
    default:
      return <Home onNavigate={navigateTo} />;
  }
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
