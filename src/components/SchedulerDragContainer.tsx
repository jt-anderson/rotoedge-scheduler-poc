import React from "react";

const CustomDragContainer = (props: any) => {
  return (
    <div
      id="unqueuedItemsContainer"
      className={`unqueuedItemsContainer-${props.armId}`}
      ref={props.dragContainerRef}
    >
      {props.children}
    </div>
  );
};

export default CustomDragContainer;
