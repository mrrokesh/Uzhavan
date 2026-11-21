import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Dimensions,
  Keyboard,
  findNodeHandle,
  Platform,
  ScrollView,
  TextInput,
  UIManager,
  type HostInstance,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * How far the keyboard overlaps the window. Zero when Android already resized
 * the window, so we don't lift the screen twice.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      const windowHeight = Dimensions.get("window").height;
      const overlap = windowHeight - e.endCoordinates.screenY;
      setInset(overlap > 0 ? overlap : 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}

type Reveal = (node: HostInstance | number | null) => void;

const revealers: Reveal[] = [];

/** Ask the frontmost form to scroll this input above the keyboard. */
export function revealInput(node: HostInstance | number | null) {
  revealers[revealers.length - 1]?.(node);
}

type Measurable = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

/**
 * A form scroller that keeps the focused field above the keyboard, the same
 * way a chat thread keeps its composer in view.
 */
export function FormScroll({
  children,
  onScroll,
  ...rest
}: ComponentProps<typeof ScrollView>) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);

  useEffect(() => {
    const reveal: Reveal = (node) => {
      const input = node as Measurable | number | null;
      const scroll = ref.current;
      if (input == null || !scroll) return;
      const measureInput = (callback: (x: number, y: number, width: number, height: number) => void) => {
        if (typeof input !== "number" && input.measureInWindow) {
          input.measureInWindow(callback);
          return;
        }
        const handle = typeof input === "number" ? input : findNodeHandle(input as never);
        if (handle) UIManager.measureInWindow(handle, callback);
      };
      measureInput((_x, y, _width, height) => {
        (scroll as unknown as Measurable).measureInWindow?.((_sx, sy, _sw, sh) => {
          const overflow = y + height - (sy + sh - 16);
          if (overflow > 0) {
            scroll.scrollTo({ y: offset.current + overflow + 24, animated: true });
          }
        });
      });
    };
    revealers.push(reveal);

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        if (revealers[revealers.length - 1] === reveal) {
          reveal(TextInput.State.currentlyFocusedInput());
        }
      }, 180);
    });

    return () => {
      sub.remove();
      const index = revealers.lastIndexOf(reveal);
      if (index >= 0) revealers.splice(index, 1);
    };
  }, []);

  return (
    <ScrollView
      {...rest}
      ref={ref}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  );
}

/** Message list that stays pinned to the latest line as the composer lifts. */
export function ChatScroll({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ScrollView>(null);
  const inset = useKeyboardInset();

  useEffect(() => {
    const timer = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [inset]);

  return (
    <ScrollView
      ref={ref}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
    >
      {children}
    </ScrollView>
  );
}
