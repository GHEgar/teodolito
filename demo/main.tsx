import 'ol/ol.css';
import 'rotulo';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { fromLonLat } from 'ol/proj.js';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TeodolitoProvider, useCreateTeodolito } from 'teodolito/react';
import { ItemList } from './ItemList';
import { ElevationPanel } from './ElevationPanel';
import type { ProviderKey } from './elevation';
import { demoStyle, swatches } from './style';
import { TextEditor } from './TextEditor';
import { Toolbar } from './Toolbar';

function App() {
    const target = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<OlMap | null>(null);
    const [source, setSource] = useState<ProviderKey>('synthetic');

    useEffect(() => {
        if (!target.current) return undefined;
        const created = new OlMap({
            target: target.current,
            layers: [new TileLayer({ source: new OSM() })],
            view: new View({ center: fromLonLat([-103.35, 20.67]), zoom: 13 }),
        });
        setMap(created);
        (window as unknown as { olMap: OlMap }).olMap = created;
        return () => created.setTarget(undefined);
    }, []);

    const teodolito = useCreateTeodolito(map, {
        style: demoStyle,
        locale: 'en-US',
        defaultProps: () => ({ color: swatches[0] }),
        symbol: '🌳',
    });

    return (
        <TeodolitoProvider value={teodolito}>
            <div className="app">
                <div ref={target} className="map" data-testid="map" />
                {teodolito && map && (
                    <>
                        <Toolbar />
                        <ItemList />
                        <ElevationPanel source={source} onSource={setSource} />
                        <TextEditor map={map} />
                    </>
                )}
            </div>
        </TeodolitoProvider>
    );
}

Promise.all(['16px Rotulo', '500 16px Rotulo', '600 16px Rotulo'].map((font) => document.fonts.load(font))).finally(() => {
    createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><App /></StrictMode>);
});
