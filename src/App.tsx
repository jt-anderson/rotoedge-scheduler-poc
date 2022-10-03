/**
 * Main Application script
 */
import React, { FunctionComponent, useRef } from 'react';
import { BryntumScheduler } from '@bryntum/scheduler-react';
import { schedulerConfig } from './SchedulerConfig';
import './App.scss';

const App: FunctionComponent = () => {

    const scheduler = useRef<BryntumScheduler>(null);

    return (
        <BryntumScheduler
            ref = {scheduler}
            {...schedulerConfig}
        />
    );
};

// If you plan to use stateful React collections for data binding please check this guide
// https://www.bryntum.com/docs/scheduler/guide/Scheduler/integration/react/data-binding

export default App;
