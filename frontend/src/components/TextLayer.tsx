/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, type PaneId, type TextBox } from "../app/store";

type View = {
  scale: number;
  offsetX: number;
  offsetY: number;
  imgW?: number;
  imgH?: number;
};

type ImgRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  total: number; // scale từ “px ảnh” -> “px viewer”
};

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function computeImgRect(
  view: View,
  cwCss: number,
  chCss: number
): ImgRect | null {
  const iw = view.imgW ?? 0;
  const ih = view.imgH ?? 0;
  if (!iw || !ih) return null;
  const fit = Math.min(cwCss / iw, chCss / ih);
  const total = fit * view.scale;
  const w = iw * total;
  const h = ih * total;
  const x = (cwCss - w) / 2 + view.offsetX;
  const y = (chCss - h) / 2 + view.offsetY;
  return { x, y, w, h, total };
}

function mouseToUvInImage(
  e: React.MouseEvent,
  host: HTMLElement,
  img: ImgRect
): { u: number; v: number } | null {
  const r = host.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;

  const ix = mx - img.x;
  const iy = my - img.y;
  if (ix < 0 || iy < 0 || ix > img.w || iy > img.h) return null;

  const u = ix / img.w;
  const v = iy / img.h;
  return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };
}

function uvRectToCssRect(img: ImgRect, b: TextBox) {
  return {
    left: img.x + b.u * img.w,
    top: img.y + b.v * img.h,
    width: b.w * img.w,
    height: b.h * img.h,
  };
}

function TextBoxView(props: {
  box: TextBox;
  css: { left: number; top: number; width: number; height: number };
  fontSize: number;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onChange: (v: string) => void;
  onCommit: () => void;
  onStartMove: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent) => void;
}) {
  const {
    box,
    css,
    selected,
    editing,
    onSelect,
    onEdit,
    onChange,
    onCommit,
    fontSize,
  } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el) return;
        el.focus();
        const n = el.value.length;
        el.setSelectionRange(n, n);
      });
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const el = taRef.current;
    if (!el) return;

    // reset rồi đo scrollHeight để auto-grow
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, box.text]);

  const fontFamily = box.style?.fontFamily ?? "Arial";
  const fontWeight = box.style?.bold ? "700" : "400";
  const fontStyle = box.style?.italic ? "italic" : "normal";
  const textDecoration = box.style?.underline ? "underline" : "none";
  const color = box.style?.color ?? "#ffffff";

  return (
    <div
      role="textbox"
      className="absolute"
      style={{
        left: css.left,
        top: css.top,
        width: css.width,
        height: css.height,
        color,
        fontFamily,
        fontSize,
        fontWeight: fontWeight as any,
        fontStyle: fontStyle as any,
        textDecoration,
        lineHeight: 1.2,
        background: "transparent",
        outline:
          selected || editing ? "1px dashed rgba(255,255,255,0.55)" : "none",
        cursor: editing ? "text" : selected ? "move" : "pointer",
        userSelect: editing ? "text" : "none",
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect();

        if (!editing) {
          props.onStartMove(e);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect();
        onEdit();
      }}
    >
      {editing ? (
        <textarea
          ref={taRef}
          value={box.text}
          onChange={(e) => onChange(e.currentTarget.value)}
          onBlur={() => onCommit()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onCommit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCommit();
            }
          }}
          className="w-full h-auto resize-none outline-none border-none bg-transparent"
          style={{
            color,
            fontFamily,
            fontSize,
            fontWeight: fontWeight as any,
            fontStyle,
            textDecoration,
          }}
        />
      ) : selected ? (
        <div
          className="w-full h-full whitespace-pre-wrap break-words"
          style={{ pointerEvents: "none" }}
        >
          {box.text}
        </div>
      ) : (
        <div className="w-full h-full" style={{ pointerEvents: "none" }} />
      )}

      {selected && !editing && (
        <div
          className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm border border-white/60 bg-black/30"
          style={{ cursor: "se-resize" }}
          onMouseDown={(e) => props.onStartResize(e)}
        />
      )}
    </div>
  );
}

export default function TextLayer({
  paneId,
  view,
}: {
  paneId: PaneId;
  view: View;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState<{ cw: number; ch: number }>({
    cw: 1,
    ch: 1,
  });

  const tab = useApp((s) => s.getActiveSafe());
  const textTool = tab.textTool;
  const textBoxes = tab.textBoxes[paneId] ?? [];
  const textUI = tab.textUI;
  const linkAll = tab.linkAll;
  const panesInTab = tab.panes;
  const exporting = useApp((s) => s.exporting);

  const createTextBox = useApp((s) => s.createTextBox);
  const selectTextBox = useApp((s) => s.selectTextBox);
  const setEditingTextBox = useApp((s) => s.setEditingTextBox);
  const setTextBoxText = useApp((s) => s.setTextBoxText);
  const setTextBoxRect = useApp((s) => s.setTextBoxRect);
  const commitTextBox = useApp((s) => s.commitTextBox);

  const deleteTextBox = useApp((s) => s.deleteTextBox);
  const clearTextUI = useApp((s) => s.clearTextUI);

  const [spaceDown, setSpaceDown] = useState(false);

  const paneSize = tab.paneSize?.[paneId];
  const cwCss = Math.max(1, paneSize?.cw || hostSize.cw);
  const chCss = Math.max(1, paneSize?.ch || hostSize.ch);

  const selectedId = textUI.selected[paneId];
  const editing = textUI.editing;
  const editingId = editing?.pane === paneId ? editing.id : null;

  const canInteract = textTool.on && !exporting;

  const imgRect = useMemo(
    () => computeImgRect(view, cwCss, chCss),
    [view, cwCss, chCss]
  );

  const targets: PaneId[] = useMemo(() => {
    if (!linkAll) return [paneId];
    return panesInTab.length
      ? (panesInTab as PaneId[])
      : ([paneId] as PaneId[]);
  }, [linkAll, paneId, panesInTab]);

  const dragRef = useRef<null | {
    kind: "move" | "resize";
    id: number;
    startX: number;
    startY: number;
    start: { u: number; v: number; w: number; h: number };
  }>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setHostSize({ cw: Math.max(1, r.width), ch: Math.max(1, r.height) });
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      const cur = dragRef.current;
      const host = hostRef.current;
      if (!cur || !host || !imgRect) return;

      ev.preventDefault();

      const dx = ev.clientX - cur.startX;
      const dy = ev.clientY - cur.startY;

      const du = imgRect.w ? dx / imgRect.w : 0;
      const dv = imgRect.h ? dy / imgRect.h : 0;

      if (cur.kind === "move") {
        const b = textBoxes.find((x) => x.id === cur.id);
        const w = b?.w ?? cur.start.w;
        const h = b?.h ?? cur.start.h;
        const u = clamp(cur.start.u + du, 0, 1 - w);
        const v = clamp(cur.start.v + dv, 0, 1 - h);
        setTextBoxRect(targets, cur.id, { u, v });
        return;
      }

      const minW = 0.03;
      const minH = 0.03;
      const w = clamp(cur.start.w + du, minW, 1 - cur.start.u);
      const h = clamp(cur.start.h + dv, minH, 1 - cur.start.v);
      setTextBoxRect(targets, cur.id, { w, h });
    };

    const onUp = () => {
      if (dragRef.current) dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [imgRect, setTextBoxRect, targets, textBoxes]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // đừng block nếu đang gõ trong textarea
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (
          tag === "textarea" ||
          tag === "input" ||
          (t as any)?.isContentEditable
        )
          return;

        setSpaceDown(true);
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", () => setSpaceDown(false));

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", () => setSpaceDown(false));
    };
  }, []);

  function hitTestTextBox(
    e: React.MouseEvent,
    host: HTMLElement,
    img: ImgRect,
    boxes: TextBox[]
  ) {
    const r = host.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      const c = uvRectToCssRect(img, b);
      if (
        mx >= c.left &&
        mx <= c.left + c.width &&
        my >= c.top &&
        my <= c.top + c.height
      ) {
        return b;
      }
    }
    return null;
  }

  const onHostMouseDown = (e: React.MouseEvent) => {
    if (!textTool.on || exporting) return;
    if (spaceDown) return;
    if (e.button !== 0) return;

    const host = hostRef.current;
    if (!host || !imgRect) return;

    // 1) hit test box trước
    const hit = hitTestTextBox(e, host, imgRect, textBoxes);
    if (hit) return; // để handler trong box xử lý select/move

    // 2) click trong vùng ảnh?
    const uv = mouseToUvInImage(e, host, imgRect);
    if (!uv) {
      // click ra ngoài ảnh -> clear selection/editing
      if (textUI.editing || textUI.selected[paneId] != null) {
        finishEditingIfNeeded(-1);
        cleanupEmptySelectedIfNeeded();
        if (linkAll) clearTextUI();
        else clearTextUI(paneId);
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // 3) Nếu đang editing/selected -> chỉ clear, không tạo mới
    if (textUI.editing || textUI.selected[paneId] != null) {
      finishEditingIfNeeded(-1);
      cleanupEmptySelectedIfNeeded();
      if (linkAll) clearTextUI();
      else clearTextUI(paneId);
      return;
    }

    // 4) OK: tạo textbox mới + auto focus để typing
    const iw = view.imgW ?? 1;
    const ih = view.imgH ?? 1;

    const defaultWpx = 220;
    const fs = Math.max(
      4,
      Math.min(300, Number(textTool.style.fontSizeImgPx) || 28)
    );
    const defaultHpx = Math.max(48, Math.round(fs * 1.6));
    const w = clamp(defaultWpx / iw, 0.06, 0.9);
    const h = clamp(defaultHpx / ih, 0.04, 0.6);

    const u = clamp(uv.u, 0, 1 - w);
    const v = clamp(uv.v, 0, 1 - h);

    createTextBox(targets, paneId, {
      u,
      v,
      w,
      h,
      text: "",
      committed: false,
      style: { ...textTool.style },
    });

    // auto-select + auto-edit box vừa tạo (không cần store return id)
    requestAnimationFrame(() => {
      const t = useApp.getState().getActiveSafe();
      const arr = t.textBoxes[paneId] ?? [];
      const last = arr[arr.length - 1];
      if (!last) return;
      selectTextBox(paneId, last.id);
      setEditingTextBox(paneId, last.id);
    });
  };

  function finishEditingIfNeeded(nextId: number) {
    const t = useApp.getState().getActiveSafe();
    const ed = t.textUI.editing;
    if (!ed) return;
    if (ed.id === nextId) return; // click đúng cái đang edit thì thôi

    // targets để commit/delete: linkAll thì apply theo panes, không thì theo pane đang edit
    const editTargets: PaneId[] = t.linkAll
      ? ((t.panes?.length
          ? t.panes
          : (["A", "B", "C", "D"] as PaneId[])) as PaneId[])
      : ([ed.pane] as PaneId[]);

    // lấy text hiện tại để quyết định delete hay commit
    const arr = t.textBoxes?.[ed.pane] ?? [];
    const box = arr.find((b) => b.id === ed.id);
    const val = (box?.text ?? "").trim();

    if (!val) {
      deleteTextBox(editTargets, ed.id);
    } else {
      commitTextBox(editTargets, ed.id);
    }

    // bỏ editing + selection cũ
    if (t.linkAll) clearTextUI();
    else clearTextUI(ed.pane);
  }

  function cleanupEmptySelectedIfNeeded() {
    const t = useApp.getState().getActiveSafe();

    // nếu đang editing thì finishEditingIfNeeded sẽ xử lý
    if (t.textUI.editing) return;

    // tìm selected ở pane hiện tại (hoặc nếu linkAll thì cũng chỉ cần xử lý pane đang thao tác)
    const idSel = t.textUI.selected[paneId];
    if (idSel == null) return;

    const arr = t.textBoxes?.[paneId] ?? [];
    const box = arr.find((b) => b.id === idSel);
    if (!box) return;

    if (!(box.text ?? "").trim()) {
      const targets: PaneId[] = t.linkAll
        ? ((t.panes?.length
            ? (t.panes as PaneId[])
            : (["A", "B", "C", "D"] as PaneId[])) as PaneId[])
        : ([paneId] as PaneId[]);
      deleteTextBox(targets, box.id);
    }
  }

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      style={{ pointerEvents: canInteract && !spaceDown ? "auto" : "none" }}
      onMouseDown={onHostMouseDown}
    >
      {imgRect &&
        textBoxes.map((b) => {
          const css = uvRectToCssRect(imgRect, b);
          const isSelected = selectedId === b.id;
          const isEditing = editingId === b.id;
          const fontSize = Math.max(
            8,
            (b.style?.fontSizeImgPx ?? 28) * imgRect.total
          );

          return (
            <TextBoxView
              key={b.id}
              box={b}
              css={css}
              fontSize={fontSize}
              selected={isSelected}
              editing={isEditing}
              onSelect={() => {
                finishEditingIfNeeded(b.id);
                const t = useApp.getState().getActiveSafe();
                if (t.linkAll) clearTextUI();
                else clearTextUI(paneId);
                selectTextBox(paneId, b.id);
              }}
              onEdit={() => setEditingTextBox(paneId, b.id)}
              onChange={(val) => setTextBoxText(targets, b.id, val)}
              onCommit={() => {
                const val = (b.text ?? "").trim();
                if (!val) {
                  deleteTextBox(targets, b.id);
                } else {
                  commitTextBox(targets, b.id);
                }
                clearTextUI(paneId); // bỏ select + editing
              }}
              onStartMove={(ev) => {
                if (!canInteract || isEditing) return;
                ev.preventDefault();
                ev.stopPropagation();
                dragRef.current = {
                  kind: "move",
                  id: b.id,
                  startX: ev.clientX,
                  startY: ev.clientY,
                  start: { u: b.u, v: b.v, w: b.w, h: b.h },
                };
              }}
              onStartResize={(ev) => {
                if (!canInteract || isEditing) return;
                ev.preventDefault();
                ev.stopPropagation();
                dragRef.current = {
                  kind: "resize",
                  id: b.id,
                  startX: ev.clientX,
                  startY: ev.clientY,
                  start: { u: b.u, v: b.v, w: b.w, h: b.h },
                };
              }}
            />
          );
        })}
    </div>
  );
}
