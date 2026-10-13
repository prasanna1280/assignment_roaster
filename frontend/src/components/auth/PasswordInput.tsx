import { forwardRef, useState } from 'react';
import { IconButton, Input, InputGroup, InputRightElement, type InputProps } from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup>
      <Input ref={ref} type={visible ? 'text' : 'password'} pr="3rem" {...props} />
      <InputRightElement>
        <IconButton
          aria-label={visible ? 'Hide password' : 'Show password'}
          icon={visible ? <FiEyeOff /> : <FiEye />}
          size="sm"
          variant="ghost"
          onClick={() => setVisible((v) => !v)}
        />
      </InputRightElement>
    </InputGroup>
  );
});

export default PasswordInput;
