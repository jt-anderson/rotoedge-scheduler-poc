import Override from '../../../Core/mixin/Override.js';
import Row from '../../row/Row.js';

class RowOverride {
    static target = { class : Row }

    moveContentFromCell(cellElement, editorElement) {
        const { childNodes } = cellElement;
        const result = [];

        childNodes.forEach(node => {
            if (node !== editorElement) {
                result.push(node);
                cellElement.removeChild(node);
            }
        });

        const renderTarget = document.createElement('div');

        result.forEach(node => {
            renderTarget.appendChild(node);
        });

        return renderTarget;
    }
}

Override.apply(RowOverride);
