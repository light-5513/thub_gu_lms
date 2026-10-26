import {
  forwardRef, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEvent, type KeyboardEvent, type SelectHTMLAttributes, type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { useAnchoredPopover } from "./useAnchoredPopover";

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

// Keep the existing field-event contract while the visible control is a button.
function fieldEvent<E>(event: SyntheticEvent, select: HTMLSelectElement): E {
  return new Proxy(event, {
    get(target, property, receiver) {
      return property === "target" || property === "currentTarget" ? select : Reflect.get(target, property, receiver);
    },
  }) as unknown as E;
}

/** A styled select with a native form bridge for names, refs, validation and change events. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, className, value, defaultValue, onChange, onBlur, onFocus, onKeyDown,
    disabled, id, style, tabIndex, autoFocus, ...props }, forwardedRef) => {
    const uid = useId();
    const listId = `${uid}-options`;
    const nativeRef = useRef<HTMLSelectElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<SelectOption[]>([]);
    const [selectedValue, setSelectedValue] = useState(String(value ?? defaultValue ?? ""));
    const [activeIndex, setActiveIndex] = useState(-1);
    const search = useRef({ text: "", at: 0 });
    const { popoverRef, style: menuStyle } = useAnchoredPopover(open, triggerRef);

    useLayoutEffect(() => {
      const select = nativeRef.current;
      if (!select) return;
      const next = Array.from(select.options)
        .filter((option) => !option.hidden && !option.parentElement?.hidden)
        .map((option) => {
          const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
          return { value: option.value, label: option.label, disabled: option.disabled || Boolean(group?.disabled), group: group?.label };
        });
      setOptions((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      setSelectedValue(select.value);
    }, [children, value, defaultValue]);

    useEffect(() => {
      const form = nativeRef.current?.form;
      if (!form) return;
      let frame = 0;
      const reset = () => { frame = requestAnimationFrame(() => setSelectedValue(nativeRef.current?.value ?? "")); };
      form.addEventListener("reset", reset);
      return () => { form.removeEventListener("reset", reset); cancelAnimationFrame(frame); };
    }, []);

    useEffect(() => {
      if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
      if (!open) return;
      const outside = (event: PointerEvent) => {
        const target = event.target as Node;
        if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
      };
      const escape = (event: globalThis.KeyboardEvent) => {
        if (event.key !== "Escape") return;
        // Close the select before the surrounding dialog receives Escape.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      };
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", escape, true);
      return () => {
        document.removeEventListener("pointerdown", outside);
        document.removeEventListener("keydown", escape, true);
      };
    }, [open, popoverRef]);

    useLayoutEffect(() => {
      if (open && activeIndex >= 0) {
        document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      }
    }, [open, activeIndex, listId, menuStyle.maxHeight, menuStyle.visibility]);

    const firstEnabled = () => options.findIndex((option) => !option.disabled);
    const lastEnabled = () => {
      for (let index = options.length - 1; index >= 0; index--) if (!options[index].disabled) return index;
      return -1;
    };
    const show = (last = false) => {
      if (disabled) return;
      search.current = { text: "", at: 0 };
      const selected = options.findIndex((option) => option.value === selectedValue && !option.disabled);
      setActiveIndex(selected >= 0 ? selected : last ? lastEnabled() : firstEnabled());
      setOpen(true);
    };
    const choose = (index: number) => {
      const option = options[index];
      const select = nativeRef.current;
      if (!option || option.disabled || !select) return;
      if (select.value !== option.value) {
        select.value = option.value;
        setSelectedValue(option.value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const move = (direction: number) => {
      let next = activeIndex;
      do { next += direction; } while (options[next]?.disabled);
      if (next >= 0 && next < options.length) setActiveIndex(next);
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (nativeRef.current) onKeyDown?.(fieldEvent<KeyboardEvent<HTMLSelectElement>>(event, nativeRef.current));
      if (event.defaultPrevented) return;
      if (event.key === "Tab") { setOpen(false); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (event.altKey && event.key === "ArrowUp") { setOpen(false); return; }
        if (!open) show(event.key === "ArrowUp");
        else move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(event.key === "Home" ? firstEnabled() : lastEnabled());
      } else if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        if (!open) show();
        else {
          const direction = event.key === "PageDown" ? 1 : -1;
          let next = Math.max(0, Math.min(options.length - 1, activeIndex + direction * 8));
          while (options[next]?.disabled && next > 0 && next < options.length - 1) next += direction;
          if (options[next] && !options[next].disabled) setActiveIndex(next);
        }
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (open) choose(activeIndex); else show();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const now = Date.now();
        const text = (now - search.current.at < 700 ? search.current.text : "") + event.key.toLowerCase();
        search.current = { text, at: now };
        const query = text.split("").every((character) => character === text[0]) ? text[0] : text;
        const from = query.length === 1 ? activeIndex + 1 : Math.max(0, activeIndex);
        for (let offset = 0; offset < options.length; offset++) {
          const index = (from + offset + options.length) % options.length;
          if (!options[index].disabled && options[index].label.toLowerCase().startsWith(query)) {
            setActiveIndex(index);
            setOpen(true);
            break;
          }
        }
      }
    };
    const selected = options.find((option) => option.value === selectedValue);
    const accessibleName = props["aria-label"];

    return (
      <div className="relative min-w-0 w-full">
        <select
          {...props}
          id={id ? `${id}-native` : undefined}
          ref={(element) => {
            nativeRef.current = element;
            if (typeof forwardedRef === "function") forwardedRef(element);
            else if (forwardedRef) forwardedRef.current = element;
          }}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="select-native-bridge"
          onChange={(event) => { setSelectedValue(event.currentTarget.value); onChange?.(event); }}
          onFocus={() => triggerRef.current?.focus({ preventScroll: true })}
          onKeyDown={onKeyDown}
          onInvalid={(event) => { props.onInvalid?.(event); event.preventDefault(); triggerRef.current?.focus(); }}
        >
          {children}
        </select>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={accessibleName}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={props["aria-invalid"]}
          aria-required={props.required || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          disabled={disabled}
          tabIndex={tabIndex}
          autoFocus={autoFocus}
          style={style}
          className={clsx("input-recess select-trigger flex w-full min-w-0 items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm disabled:cursor-not-allowed", className)}
          data-open={open || undefined}
          onClick={() => open ? setOpen(false) : show()}
          onKeyDown={handleKeyDown}
          onFocus={(event) => {
            if (nativeRef.current) onFocus?.(fieldEvent<FocusEvent<HTMLSelectElement>>(event, nativeRef.current));
          }}
          onBlur={(event) => {
            if (!popoverRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
            if (nativeRef.current) onBlur?.(fieldEvent<FocusEvent<HTMLSelectElement>>(event, nativeRef.current));
          }}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label || "Select an option"}</span>
          <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-leather-50" />
        </button>
        {open && createPortal(
          <div
            ref={popoverRef}
            id={listId}
            role="listbox"
            aria-label={accessibleName}
            aria-labelledby={props["aria-labelledby"] || (!accessibleName ? id : undefined)}
            style={menuStyle}
            className="neo-select-menu"
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.length === 0 && <p className="px-3 py-2 text-sm text-leather-50">No options available</p>}
            {options.map((option, index) => (
              <div key={`${option.value}-${index}`} role="presentation">
                {option.group && option.group !== options[index - 1]?.group && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-leather-50">{option.group}</p>}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  className="neo-select-option"
                  onPointerMove={(event) => { if (event.pointerType === "mouse" && !option.disabled) setActiveIndex(index); }}
                  onClick={() => choose(index)}
                >
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  {option.value === selectedValue && <Check size={15} className="shrink-0" aria-hidden="true" />}
                </div>
              </div>
            ))}
          </div>, document.body,
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
