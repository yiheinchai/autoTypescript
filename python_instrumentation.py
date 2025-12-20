"""
Python Runtime Instrumentation for AutoPython

This module provides runtime instrumentation for Python functions to capture
argument types during test execution. It uses import hooks to intercept module
loading and inject type capture code.
"""

import sys
import os
import json
import ast
import inspect
import types
from typing import Any, Dict, List, Optional
from pathlib import Path


class TypeCache:
    """Manages the type cache for captured runtime data"""
    
    MAX_SAMPLES_PER_PARAM = 50
    UNDEFINED_MARKER = "[[UNDEFINED_MARKER_VALUE]]"
    
    def __init__(self, cache_file: str):
        self.cache_file = cache_file
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.load()
    
    def load(self):
        """Load existing cache from file"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    self.cache = json.load(f)
            except Exception as e:
                print(f"[AutoPython] Failed to load cache: {e}", file=sys.stderr)
                self.cache = {}
    
    def save(self):
        """Save cache to file"""
        if not self.cache:
            return  # Don't overwrite with empty cache
        
        try:
            cache_dir = os.path.dirname(self.cache_file)
            if cache_dir and not os.path.exists(cache_dir):
                os.makedirs(cache_dir, exist_ok=True)
            
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            print(f"[AutoPython] Failed to save cache: {e}", file=sys.stderr)
    
    def record_call(self, func_name: str, args: tuple, kwargs: dict, param_names: List[str]):
        """Record a function call with its arguments"""
        if func_name not in self.cache:
            self.cache[func_name] = {
                'callCount': 0,
                'paramNames': param_names,
                'paramData': {}
            }
        
        # Update param names if provided
        if param_names and len(param_names) > 0:
            self.cache[func_name]['paramNames'] = param_names
        
        self.cache[func_name]['callCount'] += 1
        
        # Record positional arguments
        for i, arg in enumerate(args):
            if i not in self.cache[func_name]['paramData']:
                self.cache[func_name]['paramData'][i] = []
            
            serialized = self._serialize_value(arg)
            samples = self.cache[func_name]['paramData'][i]
            
            if len(samples) >= self.MAX_SAMPLES_PER_PARAM:
                samples.pop(0)
            
            samples.append(serialized)
        
        # Record keyword arguments
        for i, param_name in enumerate(param_names):
            if param_name in kwargs:
                if i not in self.cache[func_name]['paramData']:
                    self.cache[func_name]['paramData'][i] = []
                
                serialized = self._serialize_value(kwargs[param_name])
                samples = self.cache[func_name]['paramData'][i]
                
                if len(samples) >= self.MAX_SAMPLES_PER_PARAM:
                    samples.pop(0)
                
                samples.append(serialized)
    
    def _serialize_value(self, value: Any, depth: int = 0, max_depth: int = 10) -> Any:
        """Serialize a value for storage, handling special types"""
        if depth > max_depth:
            return "[Max Depth Exceeded]"
        
        if value is None:
            return None
        
        if callable(value):
            return "[Function]"
        
        if isinstance(value, (str, int, float, bool)):
            return value
        
        if isinstance(value, (list, tuple)):
            return [self._serialize_value(item, depth + 1, max_depth) for item in value]
        
        if isinstance(value, dict):
            result = {}
            for k, v in value.items():
                result[str(k)] = self._serialize_value(v, depth + 1, max_depth)
            return result
        
        # For custom objects, try to extract public attributes
        if hasattr(value, '__dict__'):
            result = {}
            for k, v in value.__dict__.items():
                if not k.startswith('_'):
                    result[k] = self._serialize_value(v, depth + 1, max_depth)
            return result
        
        # Fallback: convert to string representation
        try:
            return str(value)
        except Exception:
            return "[Unserializable]"


class FunctionWrapper:
    """Wrapper that captures function calls"""
    
    def __init__(self, func, func_name: str, type_cache: TypeCache):
        self.func = func
        self.func_name = func_name
        self.type_cache = type_cache
        self.param_names = self._get_param_names()
    
    def _get_param_names(self) -> List[str]:
        """Extract parameter names from function signature"""
        try:
            sig = inspect.signature(self.func)
            return [param.name for param in sig.parameters.values()]
        except Exception:
            return []
    
    def __call__(self, *args, **kwargs):
        """Capture arguments and call original function"""
        try:
            self.type_cache.record_call(self.func_name, args, kwargs, self.param_names)
        except Exception as e:
            print(f"[AutoPython] Failed to record call to {self.func_name}: {e}", file=sys.stderr)
        
        return self.func(*args, **kwargs)
    
    def __get__(self, instance, owner):
        """Support for methods - bind to instance"""
        if instance is None:
            return self
        return types.MethodType(self, instance)


class InstrumentationFinder:
    """Meta path finder to intercept module imports"""
    
    def __init__(self, type_cache: TypeCache, workspace_root: str):
        self.type_cache = type_cache
        self.workspace_root = os.path.abspath(workspace_root)
        self.instrumented_modules = set()
    
    def find_module(self, fullname, path=None):
        """Find module to potentially instrument"""
        # This is for Python < 3.4 compatibility
        return None
    
    def find_spec(self, fullname, path, target=None):
        """Find module spec (Python 3.4+)"""
        # We don't need to return a spec; we'll use exec_module hook
        return None


class InstrumentationLoader:
    """Loader that instruments modules after they're loaded"""
    
    def __init__(self, type_cache: TypeCache, workspace_root: str):
        self.type_cache = type_cache
        self.workspace_root = os.path.abspath(workspace_root)
        self.instrumented_modules = set()
    
    def should_instrument(self, module_name: str, module_file: Optional[str]) -> bool:
        """Determine if a module should be instrumented"""
        if module_name in self.instrumented_modules:
            return False
        
        if not module_file:
            return False
        
        # Only instrument files in the workspace
        try:
            module_path = os.path.abspath(module_file)
            if not module_path.startswith(self.workspace_root):
                return False
            
            # Skip test files and __pycache__
            if '__pycache__' in module_path or '/test' in module_path or '\\test' in module_path:
                return False
            
            # Skip site-packages
            if 'site-packages' in module_path:
                return False
            
            return True
        except Exception:
            return False
    
    def instrument_module(self, module):
        """Instrument all functions in a module"""
        module_name = module.__name__
        
        if module_name in self.instrumented_modules:
            return
        
        module_file = getattr(module, '__file__', None)
        if not self.should_instrument(module_name, module_file):
            return
        
        self.instrumented_modules.add(module_name)
        
        # Instrument all functions in the module
        for name, obj in list(module.__dict__.items()):
            if callable(obj) and not name.startswith('_'):
                # Skip already wrapped functions
                if isinstance(obj, FunctionWrapper):
                    continue
                
                # Get the qualified function name
                if hasattr(obj, '__module__') and obj.__module__ == module_name:
                    func_name = f"{module_name}.{name}"
                    try:
                        wrapped = FunctionWrapper(obj, func_name, self.type_cache)
                        setattr(module, name, wrapped)
                    except Exception as e:
                        print(f"[AutoPython] Failed to wrap {func_name}: {e}", file=sys.stderr)


# Global type cache instance
_type_cache: Optional[TypeCache] = None
_loader: Optional[InstrumentationLoader] = None
_original_import = __builtins__.__import__


def _instrumented_import(name, globals=None, locals=None, fromlist=(), level=0):
    """Custom import function that instruments modules"""
    module = _original_import(name, globals, locals, fromlist, level)
    
    if _loader and hasattr(module, '__name__'):
        _loader.instrument_module(module)
    
    return module


def install_instrumentation(cache_file: str, workspace_root: str):
    """Install the instrumentation hooks"""
    global _type_cache, _loader
    
    _type_cache = TypeCache(cache_file)
    _loader = InstrumentationLoader(_type_cache, workspace_root)
    
    # Hook into the import system
    __builtins__.__import__ = _instrumented_import
    
    # Save cache on exit
    import atexit
    atexit.register(lambda: _type_cache.save() if _type_cache else None)
    
    print(f"[AutoPython] Instrumentation installed. Cache: {cache_file}", file=sys.stderr)


def get_type_cache() -> Optional[TypeCache]:
    """Get the global type cache instance"""
    return _type_cache
