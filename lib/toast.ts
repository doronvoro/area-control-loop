import { toast } from 'sonner';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
    });
  },
  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
    });
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },
};
