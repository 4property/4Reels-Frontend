// Entry point. Static imports are evaluated in source order (depth-first),
// so globals.js sets window.React / window.ReactDOM before any component runs.
// Each component file declares its component and assigns it to window, so
// the cross-file global references in the existing code keep resolving.
import './globals.js';
import '../styles.css';

import '../data/mock.js';

import '../components/Icon.jsx';
import '../components/Cover.jsx';
import '../components/UI.jsx';
import '../components/Dashboard.jsx';
import '../components/SocialConfig.jsx';
import '../components/MusicConfig.jsx';
import '../components/BrandConfig.jsx';
import '../components/ReelDefaultsConfig.jsx';
import '../components/AutomationAdmin.jsx';
import '../components/AdminTeam.jsx';
import '../components/AgencyDrawer.jsx';
import '../components/ReelEditor.jsx';
import '../components/App.jsx';
