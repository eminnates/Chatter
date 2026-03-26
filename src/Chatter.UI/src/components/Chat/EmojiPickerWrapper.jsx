import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export default function EmojiPickerWrapper(props) {
  return (
    <Picker 
      data={data} 
      theme="dark"
      previewPosition="none"
      skinTonePosition="none"
      navPosition="none"
      {...props} 
    />
  );
}
