import React, { useState, useEffect, useCallback, useRef } from "react";
import { Autocomplete } from "@mantine/core";
import { fetchProjects, createProject } from "../api";
import type { Project } from "../types";

interface ProjectAutocompleteProps {
  value: number | null; // project_id
  onChange: (projectId: number) => void;
  required?: boolean;
}

export default function ProjectAutocomplete({
  value,
  onChange,
  required = false,
}: ProjectAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef<number | null>(value);
  const isInternalChangeRef = useRef(false);

  // Fetch all projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Update input value only when value prop changes from outside (not from our own onChange)
  useEffect(() => {
    // Skip if this change was triggered internally
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    // Only update if the value prop actually changed
    if (previousValueRef.current !== value) {
      previousValueRef.current = value;
      
      if (value && projects.length > 0) {
        const project = projects.find((p) => p.id === value);
        if (project) {
          setInputValue(project.name);
        }
      } else if (!value) {
        setInputValue("");
      }
    }
  }, [value]);

  // When projects first load and we have a value, sync the input (only if input is empty)
  useEffect(() => {
    if (value && projects.length > 0 && !inputValue) {
      const project = projects.find((p) => p.id === value);
      if (project) {
        setInputValue(project.name);
      }
    }
  }, [projects.length]); // Only when projects list is first populated

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const allProjects = await fetchProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  const searchProjects = useCallback(async (searchTerm: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = searchTerm
          ? await fetchProjects(searchTerm)
          : await fetchProjects();
        setProjects(results);
      } catch (error) {
        console.error("Failed to search projects:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  const handleCreateProject = async (projectName: string) => {
    if (!projectName.trim()) return;

    try {
      setIsLoading(true);
      const newProject = await createProject(projectName.trim());
      setProjects((prev) => [...prev, newProject]);
      setInputValue(newProject.name);
      isInternalChangeRef.current = true;
      onChange(newProject.id);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project. It may already exist.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSubmit = (selectedValue: string) => {
    const project = projects.find((p) => p.name === selectedValue);
    if (project) {
      isInternalChangeRef.current = true;
      onChange(project.id);
    } else {
      // This shouldn't happen if data is correct, but handle it anyway
      handleCreateProject(selectedValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // When user presses Enter and the value doesn't match any project, create it
    if (event.key === "Enter" && inputValue.trim()) {
      const matchingProject = projects.find(
        (p) => p.name.toLowerCase() === inputValue.toLowerCase().trim()
      );
      if (!matchingProject) {
        event.preventDefault();
        handleCreateProject(inputValue);
      }
    }
  };

  // Format projects as Autocomplete data (array of objects with value and label)
  const projectData = projects.map((project) => ({
    value: project.name,
    label: project.description ? `${project.name} - ${project.description}` : project.name,
  }));

  return (
    <Autocomplete
      value={inputValue}
      onChange={setInputValue}
      onOptionSubmit={handleOptionSubmit}
      data={projectData}
      placeholder="Type to search or create project..."
      required={required}
      loading={isLoading}
      onKeyDown={handleKeyDown}
      onInput={(event) => {
        const searchTerm = event.currentTarget.value;
        if (searchTerm) {
          searchProjects(searchTerm);
        } else {
          loadProjects();
        }
      }}
    />
  );
}
