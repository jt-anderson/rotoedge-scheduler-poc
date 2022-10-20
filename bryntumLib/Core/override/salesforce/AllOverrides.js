// import createElementFromTemplate override first, as one of the patches below will rely on it
import './DomHelperOverride.js';

import './BrowserHelperOverridePointerEvents.js';
import './BrowserHelperOverrideQueryString.js';
import './ClickRepeaterOverride.js';
import './DomClassListOverride.js';
import './DomHelperOverrideActiveElement.js';
import './DomHelperOverrideElementFromPoint.js';
import './DomHelperOverrideGetCommonAncestor.js';
import './DomHelperOverrideIsInView.js';
import './DomHelperOverrideIsVisible.js';
import './DragHelperOverride.js';
import './EventHelperOverride.js';
import './EventHelperOverrideAddListener.js';
import './FieldOverrideAutocomplete.js';
import './NavigatorOverride.js';
import './ObjectsOverrideIsObject.js';
import './PanelOverride.js';
import './WidgetOverrideGetFloatRoot.js';
import './WidgetOverrideSetDragImage.js';
import './WidgetOverrideToFront.js';
