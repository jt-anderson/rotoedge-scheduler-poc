import React from "react";

interface CustomDragContainerProps {
  armId: number;
  dragContainerRef: any;
  children: any;
}

const CustomDragContainer: React.FC<CustomDragContainerProps> = ({
  armId,
  dragContainerRef,
  children,
}) => {
  return (
    <div
      id="unqueuedItemsContainer"
      className={`unqueuedItemsContainer-${armId}`}
      ref={dragContainerRef}
    >
      {children}
    </div>
  );
};

export default CustomDragContainer;
