import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useHotkeys } from 'react-hotkeys-hook';

import TableForm from '@/components/table_form';
import FieldForm from '@/components/field_form';
import LinkPath from '@/components/link_path';
import LinkModal from '@/components/link_modal';
import Nav from '@/components/nav';
import Table from '@/components/table';
import TableNav from '@/components/table_nav';
import ContextMenu from '@/components/context_menu';
import LogsDrawer from '@/components/logs';
import graphState from '@/hooks/use-graph-state';
import tableModel from '@/hooks/table-model';

const ExportModal = dynamic(() => import('@/components/export_modal'), {
    ssr: false,
});
const ImportModal = dynamic(() => import('@/components/import_modal'), {
    ssr: false,
});

export default function Home() {
    const {
        tableList,
        tableDict,
        setTableDict,
        linkDict,
        setLinkDict,
        box,
        setBox,
        name,
        version,
    } = graphState.useContainer();

    const { updateGraph, addTable } = tableModel();

    const links = useMemo(() => Object.values(linkDict), [linkDict]);
    const svg = useRef();

    // ''|dragging|moving|linking
    const [mode, setMode] = useState('');
    // offset of svg origin
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [movingTable, setMovingTable] = useState();

    const [showModal, setShowModal] = useState('');
    const [showDrawer, setShowDrawer] = useState('');
    const [formChange, setFormChange] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [tableSelectedId, setTableSelectId] = useState(null);

    const [linkStat, setLinkStat] = useState({
        startX: null,
        startY: null,
        startTableId: null,
        startField: null,
        endX: null,
        endY: null,
    });

    // MiniMap相关事件处理和监听全部移到Home组件顶层
    const miniMapRef = useRef();
    const miniMapState = useRef({
        margin: 20,
        svgW: 200,
        svgH: 130,
        minX: 0,
        minY: 0,
        scale: 1,
        viewW: 0,
        viewH: 0,
    });
    const [miniMapDragging, setMiniMapDragging] = useState(false);
    const [miniMapDragOffset, setMiniMapDragOffset] = useState({ x: 0, y: 0 });

    // MiniMap事件处理函数
    const handleMiniMapMouseDown = (e, viewX, viewY, viewW, viewH) => {
      const rect = miniMapRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // 判断是否点在红框内
      if (
        mouseX >= viewX && mouseX <= viewX + viewW &&
        mouseY >= viewY && mouseY <= viewY + viewH
      ) {
        setMiniMapDragging(true);
        setMiniMapDragOffset({ x: mouseX - viewX, y: mouseY - viewY });
      } else {
        // 直接跳转到点击位置
        const { minX, minY, scale, margin } = miniMapState.current;
        const newBoxX = (mouseX - margin) / scale + minX;
        const newBoxY = (mouseY - margin) / scale + minY;
        setBox(state => ({
          ...state,
          x: newBoxX,
          y: newBoxY,
        }));
      }
    };

    /**
     * It sets the offset to the mouse position relative to the box, and sets the mode to 'draging'
     */
    const mouseDownHandler = e => {
        if (
            (e.target.tagName === 'svg' || e.target.tagName === 'rect') &&
            e.button !== 2
        ) {
            setOffset({
                x: box.x + (e.clientX * box.w) / global.innerWidth,
                y: box.y + (e.clientY * box.h) / global.innerHeight,
            });
            setMode('draging');
        }
    };

    /**
     * It sets the moving table to the table that was clicked on, and sets the mode to moving
     * @param e - the event object
     * @param table - the table object that was clicked on
     */
    const tableMouseDownHandler = (e, table) => {
        if (e.button === 2 || version !== 'currentVersion') return;
        const { x: cursorX, y: cursorY } = getSVGCursor(e);

        setMovingTable({
            id: table.id,
            offsetX: cursorX - table.x,
            offsetY: cursorY - table.y,
        });

        setMode('moving');
        e.preventDefault();
        // e.stopPropagation();
    };

    /**
     * When the user releases the mouse button, if the user was in linking mode, and the user is not
     * linking the same table to itself, then add a new link to the link dictionary
     */
    const mouseUpHandler = e => {
        if (mode === 'linking') {
            const row = e.target.classList.contains('row') ? e.target : e.target.closest('.row');
            if (row) {
                const endTableId = row.getAttribute('tableid');
                const endField = row.getAttribute('fieldid');

                if (
                    !links.find(
                        link =>
                            [
                                `${link.endpoints[0].id} ${link.endpoints[0].fieldId}`,
                                `${link.endpoints[1].id} ${link.endpoints[1].fieldId}`,
                            ]
                                .sort()
                                .join(' ') ===
                            [
                                `${linkStat.startTableId} ${linkStat.startField}`,
                                `${endTableId} ${endField}`,
                            ]
                                .sort()
                                .join(' ')
                    )
                ) {
                    setLinkDict(state => {
                        const id = nanoid();
                        return {
                            ...state,
                            [id]: {
                                id,
                                name: null,
                                endpoints: [
                                    {
                                        id: linkStat.startTableId,
                                        // tableName: "sales",
                                        // fieldNames: ["id"],
                                        fieldId: linkStat.startField,
                                        relation: '1',
                                    },
                                    {
                                        id: endTableId,
                                        // tableName: "store",
                                        // fieldNames: ["id"],
                                        fieldId: endField,
                                        relation: '*',
                                    },
                                ],
                            },
                        };
                    });
                }
            }
        }
        setMode('');
        setLinkStat({
            startX: null,
            startY: null,
            startTableId: null,
            startField: null,
            endX: null,
            endY: null,
        });
        setMovingTable(null);
    };

    /**
     * It takes a mouse event and returns the cursor position in SVG coordinates
     * @returns The cursor position in the SVG coordinate system.
     */
    const getSVGCursor = ({ clientX, clientY }) => {
        let point = svg.current.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        return point.matrixTransform(svg.current.getScreenCTM().inverse());
    };

    /**
     * > When the mouse is moving, if the mode is 'draging', then update the box state with the new x
     * and y values. If the mode is 'moving', then update the tableDict state with the new x and y
     * values. If the mode is 'linking', then update the linkStat state with the new endX and endY
     * values
     */
    const mouseMoveHandler = e => {
        if (!mode) return;
        if (mode === 'draging') {
            setBox(state => {
                return {
                    w: state.w,
                    h: state.h,
                    x: offset.x - e.clientX * (state.w / global.innerWidth),
                    y: offset.y - e.clientY * (state.h / global.innerHeight),
                    clientH: state.clientH,
                    clientW: state.clientW,
                };
            });
        }

        if (mode === 'moving') {
            const { x: cursorX, y: cursorY } = getSVGCursor(e);

            setTableDict(state => {
                return {
                    ...state,
                    [movingTable.id]: {
                        ...state[movingTable.id],
                        x: cursorX - movingTable.offsetX,
                        y: cursorY - movingTable.offsetY,
                    },
                };
            });
        }

        if (mode === 'linking') {
            const { x, y } = getSVGCursor(e);
            setLinkStat({
                ...linkStat,
                endX: x,
                endY: y + 3,
            });
        }
    };

    /**
     * `wheelHandler` is a function that takes an event object as an argument and returns a function
     * that takes a state object as an argument and returns a new state object
     */
    const wheelHandler = e => {
        e.preventDefault();
        let { deltaY } = e;
        const cursor = getSVGCursor(e);

        setBox(state => {
            let scale = deltaY > 0 ? 1.1 : 0.9;
            let newW = state.w * scale;
            let newH = state.h * scale;

            // 限制缩放范围
            if (newW > 4000 || newW < 600) return state;

            // 以鼠标为中心缩放
            let newX = cursor.x - ((cursor.x - state.x) * scale);
            let newY = cursor.y - ((cursor.y - state.y) * scale);

            return {
                x: newX,
                y: newY,
                w: newW,
                h: newH,
                clientH: state.clientH,
                clientW: state.clientW,
            };
        });
    };

    useEffect(() => {
        const instance = svg.current;
        instance.addEventListener('wheel', wheelHandler, { passive: false });
        return () => {
            instance.removeEventListener('wheel', wheelHandler, {
                passive: false,
            });
        };
    }, [version]);

    /**
     * It sets the linkStat object to the current mouse position and the table and field that the mouse
     * is over
     */
    const gripMouseDownHandler = e => {
        if (version !== 'currentVersion') return;
        const { x, y } = getSVGCursor(e);
        const row = e.currentTarget.closest('.row');
        setLinkStat({
            ...linkStat,
            startX: x,
            startY: y,
            startTableId: row.getAttribute('tableid'),
            startField: row.getAttribute('fieldid'),
        });
        setMode('linking');
        e.preventDefault();
        e.stopPropagation();
    };

    const handlerTableSelected = table => {
        // 表位置移动后的 x/y 会表现不一致
        const svgInfo = svg.current.getBBox();
        setBox(state => {
            const newX = table.x + svgInfo.x - (table.x > -16 ? 264 : -table.x / 2);
            return {
                w: state.w,
                h: state.h,
                x: newX,
                y: svgInfo.y + table.y + (svgInfo.y < 0 ? 88 : -72),
                clientH: state.clientH,
                clientW: state.clientW,
            };
        });
        setTableSelectId(table.id);
    };

    useHotkeys('ctrl+s, meta+s', () => updateGraph(), { preventDefault: true }, [
        tableDict,
        linkDict,
        name,
    ]);

    useHotkeys('ctrl+n, meta+n', () => addTable(), { preventDefault: true }, [tableDict, linkDict]);

    useHotkeys('ctrl+e, meta+e', () => setShowModal('export'), { preventDefault: true }, [
        tableDict,
        linkDict,
    ]);

    useHotkeys('ctrl+i, meta+i', () => setShowModal('import'), { preventDefault: true });

    useHotkeys('ctrl+h, meta+h', () => setShowDrawer('logs'), { preventDefault: true });

    useHotkeys(
        'ctrl+=, meta+=',
        () => {
            setBox(state => ({
                x: state.x + state.w * 0.05,
                y: state.y + state.h * 0.05,
                w: state.w * 0.9,
                h: state.h * 0.9,
                clientH: state.clientH,
                clientW: state.clientW,
            }));
        },
        { preventDefault: true }
    );

    useHotkeys(
        'ctrl+-, meta+-',
        () => {
            setBox(state => ({
                x: state.x - state.w * 0.05,
                y: state.y - state.h * 0.05,
                w: state.w * 1.1,
                h: state.h * 1.1,
                clientH: state.clientH,
                clientW: state.clientW,
            }));
        },
        { preventDefault: true }
    );

    useHotkeys(
        'ctrl+0, meta+0',
        () => {
            setBox(state => ({
                x: 0,
                y: 0,
                w: state.clientW,
                h: state.clientH,
                clientH: state.clientH,
                clientW: state.clientW,
            }));
        },
        { preventDefault: true }
    );

    useHotkeys(
        ['ctrl+a', 'meta+a'],
        () => {
            const svgInfo = svg.current.getBBox();
            setBox(state => ({
                x: 0,
                y: svgInfo.y - 72,
                w: svgInfo.width,
                h: svgInfo.height,
                clientH: state.clientH,
                clientW: state.clientW,
            }));
        },
        { preventDefault: true }
    );

    // MiniMap事件处理函数
    useEffect(() => {
      if (!miniMapDragging) return;
      const handleMiniMapMouseMove = e => {
        const rect = miniMapRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const { minX, minY, scale, margin } = miniMapState.current;
        const newBoxX = (mouseX - miniMapDragOffset.x - margin) / scale + minX;
        const newBoxY = (mouseY - miniMapDragOffset.y - margin) / scale + minY;
        setBox(state => ({
          ...state,
          x: newBoxX,
          y: newBoxY,
        }));
      };
      const handleMiniMapMouseUp = () => {
        setMiniMapDragging(false);
      };
      window.addEventListener('mousemove', handleMiniMapMouseMove);
      window.addEventListener('mouseup', handleMiniMapMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMiniMapMouseMove);
        window.removeEventListener('mouseup', handleMiniMapMouseUp);
      };
    }, [miniMapDragging, miniMapDragOffset, setBox]);

    return (
        <div className="graph">
            <Head>
                <title>DBER</title>
                <meta
                    name="description"
                    content="Database design tool based on entity relation diagram"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <Nav setShowModal={setShowModal} setShowDrawer={setShowDrawer} />

            <ContextMenu setShowModal={setShowModal}>
                <svg
                    className="main"
                    viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
                    onMouseDown={mouseDownHandler}
                    onMouseUp={mouseUpHandler}
                    onMouseMove={mouseMoveHandler}
                    // onWheel={wheelHandler}
                    ref={svg}
                >
                    {/* 栅格背景定义 */}
                    <defs>
                        <pattern
                            id="dotgrid"
                            width="28"
                            height="28"
                            patternUnits="userSpaceOnUse"
                        >
                            <circle cx="1" cy="1" r="1" fill="#bdbdbd" />
                        </pattern>
                    </defs>
                    {/* 栅格背景填充 */}
                    <rect
                        x={box.x}
                        y={box.y}
                        width={box.w}
                        height={box.h}
                        fill="url(#dotgrid)"
                    />
                    {tableList.map(t => {
                        return (
                            <Table
                                key={t.id}
                                table={t}
                                onTableMouseDown={tableMouseDownHandler}
                                onGripMouseDown={gripMouseDownHandler}
                                tableSelectedId={tableSelectedId}
                                setTableSelectId={setTableSelectId}
                            />
                        );
                    })}
                    {links.map(link => {
                        return (
                            <LinkPath
                                link={link}
                                key={`${link.id}`}
                                setEditingLink={setEditingLink}
                            />
                        );
                    })}
                    <rect x="0" y="0" width="2" height="2"></rect>
                    {mode === 'linking' &&
                        version === 'currentVersion' &&
                        linkStat.startX != null &&
                        linkStat.endX != null && (
                            <line
                                x1={linkStat.startX}
                                y1={linkStat.startY}
                                x2={linkStat.endX}
                                y2={linkStat.endY}
                                stroke="red"
                                strokeDasharray="5,5"
                            />
                        )}
                </svg>
            </ContextMenu>

            <TableForm formChange={formChange} onFormChange={setFormChange} />
            <FieldForm formChange={formChange} onFormChange={setFormChange} />
            <LinkModal editingLink={editingLink} setEditingLink={setEditingLink} />
            <ImportModal showModal={showModal} onCloseModal={() => setShowModal('')} />
            <ExportModal showModal={showModal} onCloseModal={() => setShowModal('')} />
            <LogsDrawer showDrawer={showDrawer} onCloseDrawer={() => setShowDrawer('')} />
            <TableNav
                onTableSelected={handlerTableSelected}
                setTableSelectId={setTableSelectId}
                tableSelectedId={tableSelectedId}
            />
            {/* MiniMap 缩略图 */}
            <div
              style={{
                position: 'absolute',
                right: 24,
                bottom: 24,
                width: 200,
                height: 150,
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #ccc',
                borderRadius: 4,
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{
                fontSize: 12,
                color: '#666',
                fontWeight: 500,
                padding: '4px 0 2px 10px',
                borderBottom: '1px solid #eee',
                background: 'transparent',
                letterSpacing: 1
              }}>缩略图</div>
              {/* MiniMap SVG */}
              {(() => {
                if (!tableList.length) return null;
                const margin = 20;
                let minX = Math.min(...tableList.map(t => t.x));
                let minY = Math.min(...tableList.map(t => t.y));
                let maxX = Math.max(...tableList.map(t => t.x + (t.w || 180)));
                let maxY = Math.max(...tableList.map(t => t.y + (t.h || 48 + (t.fields?.length || 1) * 32)));
                if (minX === maxX) maxX = minX + 1;
                if (minY === maxY) maxY = minY + 1;
                const svgW = 200, svgH = 130;
                const scale = Math.min(
                  (svgW - margin * 2) / (maxX - minX),
                  (svgH - margin * 2) / (maxY - minY)
                );
                const viewX = (box.x - minX) * scale + margin;
                const viewY = (box.y - minY) * scale + margin;
                const viewW = box.w * scale;
                const viewH = box.h * scale;
                miniMapState.current = { margin, svgW, svgH, minX, minY, scale, viewW, viewH };
                return (
                  <svg
                    ref={miniMapRef}
                    width={svgW}
                    height={svgH}
                    style={{ display: 'block', marginTop: 0, cursor: miniMapDragging ? 'grabbing' : 'pointer' }}
                    onMouseDown={e => handleMiniMapMouseDown(e, viewX, viewY, viewW, viewH)}
                  >
                    {tableList.map(t => {
                      const x = (t.x - minX) * scale + margin;
                      const y = (t.y - minY) * scale + margin;
                      const w = (t.w || 180) * scale;
                      const h = ((t.h || 48 + (t.fields?.length || 1) * 32)) * scale;
                      const headerH = Math.max(14, 18 * scale); // 最小表头高度
                      const fieldCount = t.fields?.length || 1;
                      const fieldAreaH = h - headerH;
                      return (
                        <g key={t.id}>
                          {/* 表头 */}
                          <rect x={x} y={y} width={w} height={headerH} fill="#1976d2" rx={2} />
                          {/* 字段区 */}
                          <rect x={x} y={y + headerH} width={w} height={fieldAreaH} fill="#90caf9" rx={2} />
                          {/* 字段分隔线 */}
                          {Array.from({length: fieldCount - 1}).map((_, i) => (
                            <line
                              key={i}
                              x1={x}
                              x2={x + w}
                              y1={y + headerH + fieldAreaH * (i + 1) / fieldCount}
                              y2={y + headerH + fieldAreaH * (i + 1) / fieldCount}
                              stroke="#fff"
                              strokeWidth={0.5}
                            />
                          ))}
                        </g>
                      );
                    })}
                    {links.map(link => {
                      const [a, b] = link.endpoints;
                      const ta = tableDict[a.id], tb = tableDict[b.id];
                      if (!ta || !tb) return null;
                      return (
                        <line
                          key={link.id}
                          x1={(ta.x + (ta.w || 180) / 2 - minX) * scale + margin}
                          y1={(ta.y + (ta.h || 48) / 2 - minY) * scale + margin}
                          x2={(tb.x + (tb.w || 180) / 2 - minX) * scale + margin}
                          y2={(tb.y + (tb.h || 48) / 2 - minY) * scale + margin}
                          stroke="#888"
                          strokeWidth={0.5}
                        />
                      );
                    })}
                    <rect
                      x={viewX}
                      y={viewY}
                      width={viewW}
                      height={viewH}
                      fill="none"
                      stroke="#f44336"
                      strokeWidth={1.5}
                      style={{ cursor: 'grab' }}
                    />
                  </svg>
                );
              })()}
            </div>
        </div>
    );
}
