import { StyleSheet, Text, TextProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Text that follows the couple's chosen font + font colour.
 * An explicit `color` / `fontFamily` in the passed style always wins.
 */
export function AppText({ style, ...rest }: TextProps) {
  const theme = useAppTheme();
  const flat = StyleSheet.flatten(style) || {};

  return (
    <Text
      {...rest}
      style={[
        style,
        {
          color: flat.color ?? theme.textColor,
          fontFamily: flat.fontFamily ?? theme.fontFamily,
        },
      ]}
    />
  );
}

export default AppText;
